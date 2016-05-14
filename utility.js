// An interface for utility functions used by all components.
var Utility = (function () {
  'use strict';

  function assert(predicate, message) {
    if (predicate === false) {
      var x = 0; // TODO
      throw 'assertion failed: ' + message;
    }
  }

  function assertEquals(want, got, message) {
    message += '; want: ' + want + '; got: ' + got;
    assert(want === got, message);
  }

  function assertSameItems(want, got, message) {
    message += '; want: ' + want + '; got: ' + got;

    want.forEach(function (item) {
      assert(-1 != got.indexOf(item),
          message + '; want has ' + item + " but got doesn't");
    });

    got.forEach(function (item) {
      assert(-1 != got.indexOf(item),
          message + '; got has ' + item + " but want doesn't");
    });
  }

  function log(message) {
    console.log(new Date() + ': ' + message);
  }

  function logMessage(peer, label, payload) {
    log('Peer ' + peer.id + ' sent us a ' + label + ' message: "' +
         JSON.stringify(payload) + '"');
  }

  function logTopology(topology, directions) {
    var logStr = '\nTOPOLOGY\n--------\n';
    directions.forEach(function (direction) {
      logStr += direction + '\n';
      for (var pid in topology[direction]) {
        logStr += pid + ' -> ' + topology[direction][pid] + '\n';
      }
    });
    logStr += '\n';

    log(logStr);
  }

  return {
    assert: assert,
    assertEquals: assertEquals,
    assertSameItems: assertSameItems,
    log: log,
    logMessage: logMessage,
    logTopology: logTopology,
  };
})();

// polyfill for Object.assign
if (typeof Object.assign != 'function') {
  (function () {
    Object.assign = function (target) {
      'use strict';
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var output = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var source = arguments[index];
        if (source !== undefined && source !== null) {
          for (var nextKey in source) {
            if (Object.prototype.hasOwnProperty.call(source, nextKey)) {
              output[nextKey] = source[nextKey];
            }
          }
        }
      }
      return output;
    };
  })();
}
