import React, { Component } from 'react';
import { Navbar, Nav, NavItem, FormControl, FormGroup, Button, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './navigationBar.css';
import {ClientState} from'../API.ts'


export default class navigationBar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      Email: '', 
      Password: '',
      LoggedIn:false ,
      haveLogIn: false, 
      LogInAttempt: false, 
      haveLogOut: false, 
      LogOutAttempt: false,         
    };
    this.onSubmit = this.onSubmit.bind(this);
    this.LogoutonSubmit = this.LogoutonSubmit.bind(this);
    this.GuestSubmit = this.GuestSubmit.bind(this);

  }
    EmailonChange = (e) => {
      this.setState({Email : e.target.value});
    }  

    PasswordonChange = (e) => {
      this.setState({Password : e.target.value});
    }      
    onSubmit = (e) => {
      e.preventDefault();
      this.setState({LoggedIn:true})
      this.setState({LogInAttempt: true})
      this.setState({haveLogIn: false});
      this.props.controller.login(this.state.Email, this.state.Password).then(
        (login) => {
            this.setState({
                haveLogIn: true,
            });
        },
        (error) => {
            this.setState({
                haveLogIn: true,
                LogInError: error.message,
            });
        },
      );


     
    }

    LogoutonSubmit = (e) => {
      e.preventDefault();
      this.setState({LoggedIn:false})
      this.setState({LogOutAttempt: true})
      this.setState({haveLogOut: false});
      this.props.controller.logout().then(
        (logout) => {
            this.setState({
                haveLogOut: true,
                LoggedIn: false
            });
        },
        (error) => {
            this.setState({
                haveLogOut: true,
                LogOutError: error.message,
                LoggedIn: false
            });
        },)
      
    }

    GuestSubmit = (e) => {
      e.preventDefault();
      this.setState({LoggedIn:true})
      this.setState({LogInAttempt: true})
      this.setState({haveLogIn: false});
      this.props.controller.loginGuest().then(
        (login) => {
            this.setState({
                haveLogIn: true,
            });
        },
        (error) => {
            this.setState({
                haveLogIn: true,
                LogInError: error.message,
            });
        },
      );

     
    }


  render() {
    const { Email, Password, LoggedIn} = this.state;
    var text='';
    if (this.state.LoggedIn && this.state.LogInAttempt && this.state.haveLogIn){text = "Logged In"}
    if (this.state.LogInError){text= this.state.LogInError}
    if (this.state.LogOutError){text = this.state.LogOutError}
    if (!this.state.LoggedIn && this.state.LogOutAttempt && this.state.haveLogOut){text = "Not Logged In"}
    console.log( ". Email = " + this.state.Email + ". Password = " + this.state.Password + ". LoggedIn = " + this.state.LoggedIn )

    return (
      <Navbar collapseOnSelect>

          <Nav>
            <NavItem eventKey={0} componentClass={Link} href="/" to="/">
              Home
            </NavItem>
          </Nav>
          <Navbar.Toggle />
        <Navbar.Collapse>
          <Nav>                     
            <NavItem eventKey={1} componentClass={Link} href="/User" to="/User">
              User
            </NavItem>
          </Nav>
          <Nav>             
            <NavItem eventKey={2} componentClass={Link} href="/Customer" to="/Customer">
              All projects
            </NavItem>
          </Nav>


          
          <Navbar.Form pullRight >
          <Button onClick= {this.LogoutonSubmit}>Log out</Button>
          {'   '}
          <Button onClick = {this.GuestSubmit}>Log in as guest</Button>
          {'    '}

            <FormGroup>




                               
              <FormControl 
                type="text" 

                placeholder="Enter Email"
                value = {this.state.Email}
                onChange={this.EmailonChange}                
                />
              <FormControl 
                type="text" 

                placeholder="Password" 
                value = {this.state.Password}
                onChange={this.PasswordonChange}                
                />    
            <Button onClick = {this.onSubmit}>Log in</Button>                          
            </FormGroup>{' '}

            </Navbar.Form>
          <Navbar.Text>
            {text}
          </Navbar.Text>            


        </Navbar.Collapse>
      </Navbar>
    )
  }
}