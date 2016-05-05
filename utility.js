// An interface for utility functions used by all components.
var Utility = (function () {
  'use strict';

  var assert = function (predicate, message) {
    if (!predicate) {
      throw 'assertion failed: ' + message;
    }
  };

  var log = function (message) {
    console.log(new Date() + ': ' + message);
  };

  var logMessage = function (peer, label, payload) {
    log('Peer ' + peer.id + ' sent us a ' + label + ' message: "' +
         payload + '"');
  };

  return {
    assert: assert,
    log: log,
    logMessage: logMessage,
  };
})();
