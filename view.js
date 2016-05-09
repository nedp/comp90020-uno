var GameView = React.createClass({
  displayName: 'GameView',

  // initial state of the view
  getInitialState: function () {
    return { message: 'Game initialising', myHand: [] };
  },
  // render function for the view
  render: function () {
    var players = [];
    if (this.state.players) {
      this.state.players.forEach(function (value) {
        players.push(React.createElement(PlayerView, { key: value, playerId: value, game: this.state }));
      }.bind(this));
    }

    var ReadyUpButton = '';
    if (!this.state.isInitialised && this.state.players && this.state.players.length > 0) {
      ReadyUpButton = React.createElement(
        'div',
        { onClick: Application.readyUp,
          className: 'btn btn-default' },
        'Ready!'
      );
    } else if (!this.state.isInitialised) {
      ReadyUpButton = React.createElement(
        'div',
        null,
        'Finding peers... Share the URL!'
      );
    }

    var TurnButton = '';
    if (this.state.isInitialised && this.state.isMyTurn) {
      TurnButton = React.createElement(
        'div',
        { onClick: Application.onTurnTaken,
          className: 'btn btn-primary' },
        'Take a turn!'
      );
    }

    var myHandCards = [];
    var idx = 0;
    this.state.myHand.forEach(function (card) {
      myHandCards.push(React.createElement(CardView, { key: idx++ + card.toUrl(), card: card }));
    });

    return React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { 'class': 'stateDiv' },
        'State: ',
        JSON.stringify(this.state),
        '!'
      ),
      TurnButton,
      ReadyUpButton,
      React.createElement(
        'div',
        null,
        players
      ),
      React.createElement(
        'div',
        { 'class': 'myHand' },
        myHandCards
      )
    );
  }
});

var CardView = React.createClass({
  displayName: 'CardView',

  render: function () {
    return React.createElement('img', { src: 'cards/' + this.props.card.toUrl() + '.svg', className: 'card' });
  }
});

var PlayerView = React.createClass({
  displayName: 'PlayerView',

  render: function () {
    var playerClass = 'notTakingTurn';
    if (this.props.game.whosTurn && this.props.playerId === this.props.game.whosTurn) {
      playerClass = 'takingTurn';
    }

    return React.createElement(
      'div',
      null,
      React.createElement(
        'p',
        { className: playerClass },
        this.props.playerId
      )
    );
  }
});

var RootComponent = ReactDOM.render(React.createElement(GameView, null), document.getElementById('reactDiv'));
