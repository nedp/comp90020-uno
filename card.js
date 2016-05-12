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
  // every time we fetch a card.
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

  // Returns the type of the turn caused by playing this card.
  function turnType(cardType) {
    switch (cardType) {
      case CARDTYPES.SKIP:
      case CARDTYPES.DRAW2:
      case CARDTYPES.WILDDRAW4:
        return TurnType.SKIP;

      case CARDTYPES.REVERSE:
        return TurnType.REVERSE;

      default:
        return TurnType.NORMAL;
    }
  }

  function create(type, suit, number) {
    // Figure out how many cards this card will make the
    // next player draw.
    var nCardsToDraw = 0;
    switch (type) {
      case CARDTYPES.DRAW2:
        nCardsToDraw = 2;
        break;

      case CARDTYPES.WILDDRAW4:
        nCardsToDraw = 4;
        break;
    }

    return {
      type: type,
      suit: suit || null,
      number: (number !== undefined) ? number : null,
      toString: toString,
      turnType: turnType(type),
      nCardsToDraw: nCardsToDraw,
    };
  }

  function fromString(string) {
    if (string && string.split) {
      var parts = string.split('-');

      var type = parts[0] || null;
      var suit = parts[1] || null;
      var number = parts[2] ? parseInt(parts[2]) : null;

      return create(type, suit, number);
    } else {
      return null;
    }
  }

  function fetchCard() {
    // get a random number between 0 and 107
    var cardChance = Math.floor(Math.random() * 108);

    // decide on the colour of the card, only relevant for numbers and specials
    var suit = null;
    if (cardChance < 100) {
      suit = SUIT[Object.keys(SUIT)[cardChance % 4]];
    }

    // enumerate all the coloured cards numbers, special coloured card types,
    // zeros and wilds
    // full uno deck: for reference
    // https://en.wikipedia.org/wiki/Uno_(card_game)#/media/File:UNO_cards_deck.svg
    var number = null; // Special cards don't have numbers, so it's nullable.
    var type;
    if (cardChance < 72) {
      number = cardChance % 9 + 1;
      type = CARDTYPES.NUMBER;
    } else if (cardChance < 80) {
      type = CARDTYPES.SKIP;
    } else if (cardChance < 88) {
      type = CARDTYPES.REVERSE;
    } else if (cardChance < 96) {
      type = CARDTYPES.DRAW2;
    } else if (cardChance < 100) {
      number = 0;
      type = CARDTYPES.NUMBER;
    } else if (cardChance < 104) {
      type = CARDTYPES.WILDDRAW4;
    } else if (cardChance < 108) {
      type = CARDTYPES.WILD;
    }

    return create(type, suit, number);
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
