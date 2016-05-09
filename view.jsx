var GameView = React.createClass({
  // initial state of the view
  getInitialState: function () {
    return {message: 'Game initialising', myHand: []};
  },
  // render function for the view
  render: function () {
    var players = [];
    var cntPlayers = 0;
    if (this.state.players) {
      this.state.players.forEach(function (value) {
        players.push(<PlayerView key={value}
                                 takingTurn={this.state.turnOwner === value}
                                 playerId={value}
                                 idx={++cntPlayers}></PlayerView>);
      }.bind(this));
    }

    var ReadyUpButton = '';
    if (!this.state.isInitialised &&
        this.state.players &&
        this.state.players.length > 0) {
      ReadyUpButton = <div onClick={Application.readyUp}
                           className="btn btn-default">
                        Ready!
                      </div>;
    } else if (!this.state.isInitialised) {
      ReadyUpButton = <div>Finding peers... Share the URL!</div>;
    }

    var DrawButton = '';
    if (this.state.isInitialised &&
        this.state.isMyTurn &&
        !this.state.requestSpecial) {
      DrawButton = <div onClick={Application.pickupCard}
                           className="btn btn-primary turnButton">
                        Pick up card
                      </div>;
    }

    var cancelSuiteSelection = null;
    var myHandCards = [];
    var idx = 0;
    if (this.state.requestSpecial) {
      // the suite selection of the wild card I am playing
      var card = CardFetcher.fromUrl(this.state.requestSpecial.type);
      Object.keys(CardFetcher.SUIT).forEach(function (suite) {
        var specificCard = CardFetcher.create(card.type, CardFetcher.SUIT[suite]);
        myHandCards.push(<CardView key={idx++ + specificCard.toUrl()}
                                   card={specificCard}></CardView>);
      });
      // special button for cancelling the suite selection
      cancelSuiteSelection = <div onClick={Application.cancelSuiteSelection}
                                  className='btn btn-default'>
                               Cancel Selection
                             </div>;
    } else {
      // the cards in my hand
      this.state.myHand.forEach(function (card) {
        myHandCards.push(<CardView key={idx++ + card.toUrl()} card={card}></CardView>);
      });
    }

    // show the top card if it's there
    var topCard = null;
    if (this.state.topCard) {
      topCard = <CardView card={this.state.topCard}></CardView>;
    }

    return <div>
             <h4>Players</h4>
             <div>
               {players}
             </div>
             { ReadyUpButton }
             <h4>Top Card</h4>
             <div className='topCard'>
               {topCard}
               { DrawButton }
             </div>
             <h4>Current Hand</h4>
             <div className={'myHand' +
                             (this.state.requestSpecial ? ' specialPicker' : '') +
                             (this.state.isMyTurn ? '  isMyTurn' : ' isNotMyTurn')}>
               { myHandCards }
               { cancelSuiteSelection }
             </div>
           </div>;
  },
});

var CardView = React.createClass({
  render: function () {
    return <img src={'cards/' + this.props.card.toUrl() + '.svg'}
                onClick={Application.playCard.bind(undefined, this.props.card)}
                className='card'>
          </img>;
  },
});

var PlayerView = React.createClass({
  render: function () {
    var playerClass = this.props.takingTurn ? 'takingTurn' : 'notTakingTurn';

    return <div>
             <p className={playerClass}>Player {this.props.idx} ({this.props.playerId})</p>
           </div>;
  },
});

var RootComponent = ReactDOM.render(<GameView />, document.getElementById('reactDiv'));
