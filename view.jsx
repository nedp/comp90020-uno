var GameView = React.createClass({
  getInitialState: function () {
    return {message: 'Game initialising'};
  },
  render: function () {
    return <div>Hello {JSON.stringify(this.state)}!</div>;
  },
});

var RootComponent = ReactDOM.render(<GameView />, document.getElementById('reactDiv'));
