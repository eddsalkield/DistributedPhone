import React, { Component } from 'react';
import { Navbar, Nav, NavItem, FormControl, FormGroup, Button, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './navigationBar.css';
import {ClientState} from'../API.ts'

var LoggedIn = true;
var InputEmail = '';
var InputPassword = '';
var ValidInput = true;





export default class navigationBar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      Email: '', 
      Password: ''    
    };
    this.onSubmit = this.onSubmit.bind(this);
    this.LogoutonSubmit = this.LogoutonSubmit.bind(this);

  }
    EmailonChange = (e) => {
      this.setState({Email : e.target.value});
    }  

    PasswordonChange = (e) => {
      this.setState({Password : e.target.value});
    }      
    onSubmit = (e) => {
      e.preventDefault();
      InputEmail = this.state.Email;
      InputPassword = this.state.Password;
      LoggedIn = true
      localStorage.setItem("email", InputEmail)
      localStorage.setItem("password", InputPassword)
      localStorage.setItem("loggedin", LoggedIn)



      console.log(
          ". Email = " + InputEmail + 
          ". Password = " + InputPassword +
          ". LoggedIn = " + LoggedIn
      )       
    }

    LogoutonSubmit = (e) => {
      e.preventDefault();
      InputEmail = '';
      InputPassword = '';
      LoggedIn = false

      localStorage.setItem("loggedin", LoggedIn);      

      console.log(
          ". Email = " + InputEmail + 
          ". Password = " + InputPassword +
          ". LoggedIn = " + LoggedIn
      )         
    }


  render() {
    const { Email, Password} = this.state;
    return (
      <Navbar collapseOnSelect>

          <Nav>
            <NavItem eventKey={0} componentClass={Link} href="/" to="/">
              Home
            </NavItem>
            <Navbar.Toggle />
          </Nav>
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

          <form  
          onSubmit={this.LogoutonSubmit}
          >
            <Button type="submit">Log out</Button>  
          </form>

          <form 
            onSubmit={this.onSubmit}
          >
            <Navbar.Form pullRight >
              <FormGroup>
                <Nav>
                  {/* <NavItem eventKey={4} componentClass={Link} href="/User" to="/User"> */}
                    <Button type="submit">Log in</Button>
                  {/* </NavItem> */}
                </Nav>                                 
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
              </FormGroup>{' '}
            </Navbar.Form>
          </form>
        </Navbar.Collapse>
      </Navbar>
    )
  }
}