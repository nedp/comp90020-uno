// An interface for utility functions used by all components.
var Utility = (function () {
  'use strict';

  function assert(predicate, message) {
    if (!predicate) {
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
         payload + '"');
  }

  return {
    assert: assert,
    assertEquals: assertEquals,
    assertSameItems: assertSameItems,
    log: log,
    logMessage: logMessage,
  };
})();
