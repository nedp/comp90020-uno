var CardFetcher = (function () {
  'use strict';

  var CARDTYPES = {
    NUMBER: 'n',
    SKIP: 's',
    REVERSE: 'r',
    DRAW2: 'd',
    WILD: 'w',
    WILDDRAW4: 'wd',
  };

  var SUIT = {
    RED: 'r',
    GREEN: 'g',
    YELLOW: 'y',
    BLUE: 'b',
  };

  // build the url-string (for looking up and identifying cards)
  // keep it out of the fetchCard method to avoid creating it
  // every time we fetch a card
  function toString() {
    var string = '';
    string += this.type;
    if (this.suit !== null) {
      string += '-' + this.suit;
      if (this.number !== null) {
        string += '-' + this.number;
      }
    }
    return string;
  }

  function create(type, suit, number) {
    return {
      type: type,
      suit: suit || null,
      number: (number !== undefined) ? number : null,
      toString: toString,
    };
  }

  function fromString(string) {
    if (string && string.split) {
      var parts = string.split('-');
      var card = {
        suit: parts[1] || null,
        number: parts[2] ? parseInt(parts[2]) : null,
        type: parts[0] || null,
        toString: toString,
      };

      return card;
    } else {
      return null;
    }
  }

  function fetchCard() {
    // get a random number between 0 and 107
    var cardChance = Math.floor(Math.random() * 108);

    // card with attributes to be defined
    var card = {
      suit: null,
      number: null,
      type: null,
      toString: toString,
    };

    // decide on the colour of the card, only relevant for numbers and specials
    if (cardChance < 100) {
      card.suit = SUIT[Object.keys(SUIT)[cardChance % 4]];
    }
    // enumerate all the coloured cards numbers, special coloured card types,
    // zeros and wilds
    // full uno deck: for reference
    // https://en.wikipedia.org/wiki/Uno_(card_game)#/media/File:UNO_cards_deck.svg
    if (cardChance < 72) {
      card.number = cardChance % 9 + 1;
      card.type = CARDTYPES.NUMBER;
    } else if (cardChance < 80) {
      card.type = CARDTYPES.SKIP;
    } else if (cardChance < 88) {
      card.type = CARDTYPES.REVERSE;
    } else if (cardChance < 96) {
      card.type = CARDTYPES.DRAW2;
    } else if (cardChance < 100) {
      card.number = 0;
      card.type = CARDTYPES.NUMBER;
    } else if (cardChance < 104) {
      card.type = CARDTYPES.WILDDRAW4;
    } else if (cardChance < 108) {
      card.type = CARDTYPES.WILD;
    }

    return card;
  }

  // public interface for CardFetcher
  return {
    create: create,
    fetchCard: fetchCard,
    fromString: fromString,
    CARDTYPES: CARDTYPES,
    SUIT: SUIT,
  };
})();
