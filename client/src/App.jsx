import React, { Component } from 'react';
import './App.css';
import { HashRouter as Router, Route } from 'react-router-dom';
import User from './components/User';
import Navbar from './components/navigationBar';
import Customer from './components/Customer';
import Home from './components/Home'
import API from './API.ts'




class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
   
    };
  } 

  
  render() {
    //let testpassword = this.props.controller.ChargingOnly;
    return (
      <Router>
        <div>
          <Navbar/>
          <Route exact path="/" component={Home} />
          <Route exact path="/User"  render={(props) => <User controller={this.props.controller} {...props} />}/>
          <Route exact path="/Customer"  render={(props) => <Customer controller={this.props.controller} {...props} />}/>          
        </div>
      </Router>
    );
  }
}

export default App;
