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

  var SUITES = {
    RED: 'r',
    GREEN: 'g',
    YELLOW: 'y',
    BLUE: 'b',
  };

  function fetchCard(cardChance) {
    // get a random number between 0 and 107
    // var cardChance = parseInt(Math.random() * 108);

    // card with attributes to be defined
    var card = {
      suite: null,
      number: null,
      type: null,
    };

    // decide on the colour of the card, only relevant for numbers and specials
    if (cardChance < 100) {
      card.suite = SUITES[Object.keys(SUITES)[cardChance % 4]];
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
    fetchCard: fetchCard,
    CARDTYPES: CARDTYPES,
    SUITES: SUITES,
  };
})();
