/*jslint node: true*/
'use strict';

var backend = require('beamjs').backend();
var behaviour = backend.behaviour({

    overwritePath: true
});

module.exports = function (options) {

    if (typeof options !== "object") {

        throw new Error('Invalid options');
    }
    var {
        nodes,
        version,
        path,
        queue
    } = options;
    if (!Array.isArray(nodes) || nodes.some(function (node) {

        return typeof node !== 'string' || node.length === 0;
    })) {

        throw new Error('Invalid nodes');
    }
    return behaviour({

        name: 'trigger',
        version: version || '1',
        path: path || '/trigger',
        method: 'POST',
        queue: queue || function (_, parameters) {

            return parameters.event;
        },
        parameters: {

            event: {

                key: 'event',
                type: 'body'
            },
            parameters: {

                key: 'parameters',
                type: 'body'
            },
            retry: {

                key: 'retry',
                type: 'body'
            },
            ip: {

                key: 'ip',
                type: 'middleware'
            }
        },
        returns: {

            triggered: {

                type: 'body'
            }
        }
    }, function (init) {

        return function () {

            var self = init.apply(this, arguments).self();
            let {
                event,
                parameters,
                retry = true,
                ip
            } = self.parameters;
            var error = null;
            ip = ip.split(':').pop();
            self.begin(...[
                'ErrorHandling', function (_, __, operation) {

                    operation.error(function (e) {

                        return error || e;
                    }).apply();
                }
            ]);
            if (!nodes.some(function (node) {

                return ip == node.replace(...[
                    'localhost', '127.0.0.1'
                ]).split(':').pop();
            })) {

                error = new Error('Unauthorized node');
                error.code = 403;
                return;
            }
            if (typeof event !== 'string' || event.length === 0) {

                error = new Error('Invalid event');
                error.code = 400;
                return;
            }
            if (typeof parameters === 'object') {

                if (parameters.ip != undefined) {

                    error = new Error('ip parameter is reserved!');
                    error.code = 400;
                    return;
                }
            }
            if (retry != undefined && typeof retry !== 'boolean') {

                error = new Error('Invalid retry flag');
                error.code = 400;
                return;
            }
            self.begin(...[
                'ModelObjectMapping', function (_, __, operation) {

                    operation.callback(function (response) {

                        if (typeof parameters !== "object") {

                            parameters = {};
                        }
                        parameters.ip = ip;
                        self.triggerLater(event, parameters, retry);
                        response.triggered = true;
                    }).apply();
                }
            ]);
        };
    });
};