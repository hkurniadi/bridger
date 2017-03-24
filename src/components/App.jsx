import '../assets/stylesheets/base.scss';
import React, { Component } from 'react';
import LinkedinLogin from './LinkedInLogin.jsx';
import Event from './Event.jsx';
import cookie from 'react-cookie';

let socket = io.connect();

class App extends Component {
  constructor(props) {
    super(props);

    let type = 'login';
    let data = {};
    if (cookie.load('userId')){
      type = 'events';
      data = {
          myEvent:['a','b', 'c'],
          allEvent: ['d', 'e' ]
        };
    }
    this.addEvent = this.addEvent.bind(this);
    this.eventPage = this.eventPage.bind(this);
    this.onLogout = this.onLogout.bind(this);
    this.callbackFunction = this.callbackFunction.bind(this);
    this.state = {type: type,
        data: data,
        userId: cookie.load('userId'),
        name: cookie.load('name')}
  }

  componentDidMount() {
    const app = this;
    socket.on('connect', function(data) {});
  }
  callbackFunction() {
    let app = this;
    function onSuccess(data) {
      socket.emit('user', data)
      cookie.save('userId', data.id, { path: '/' });
      cookie.save('name', data.firstName, { path: '/' });
      app.setState({
        type: 'events',
        data: {
          myEvent:['a','b', 'c'],
          allEvent: ['d', 'e' ]
        },
        userId: data.id,
        name: data.firstName});
    }

    function onError(error) {
    }

    IN.API.Raw("/people/~:(id,first-name,last-name,location,positions,industry,specialties,summary)?format=json").result(onSuccess).error(onError);
  }

  addEvent(event){
    let myEvent = this.state.data.myEvent;
    let allEvent = this.state.data.allEvent;
    myEvent.push(event);

    let index = allEvent.indexOf(event);

    if (index > -1) {
      allEvent.splice(index, 1);
    }

    this.setState({data: {
          myEvent,
          allEvent
        }});
  }

  eventPage(event){
    console.log(event)
  }

  onLogout() {
    cookie.remove('userId', { path: '/' });
    cookie.remove('name', { path: '/' });
    this.setState({
        type: 'login',
        data: {},
        userId: null,
        name: null});
  }

  render() {
    if (!this.state.userId) {
      return <LinkedinLogin callbackFunction={this.callbackFunction}/>;
    }
    if (this.state.type === "events"){
       return <Event name={this.state.name} eventPage={this.eventPage} addEvent={this.addEvent} data={this.state.data} onLogout={this.onLogout}/>
    }
    return (
      <h1>ERROR</h1>
    )
  }
};

export default App;
