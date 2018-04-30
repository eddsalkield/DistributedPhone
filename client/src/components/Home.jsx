import React, { Component } from 'react'
import { Link } from 'react-router-dom';

import { Jumbotron, Grid, Form, FormControl, FormGroup,ControlLabel, Panel, HelpBlock, Row, Col, Image, Button, Alert } from 'react-bootstrap';
import './Home.css';
import * as API from'../API.ts'

function FieldGroup({ id, label, help, ...props }) {
    return (
      <FormGroup controlId={id}>
        <ControlLabel>{label}</ControlLabel>
        <FormControl {...props} />
        {help && <HelpBlock>{help}</HelpBlock>}
      </FormGroup>
    );

  }



  export default class Home extends Component {
    constructor(props) {
      super(props);
      this.state = {
        User: '', 
        TheEmail: '',
        TheName: '',
        ThePassword: '',
        ThePasswordConfirm: '',       
      };
      this.onSubmit = this.onSubmit.bind(this);
    }

    EmailonChange = (e) => {
      this.setState({TheEmail : e.target.value});
    }

    NameonChange = (e) => {
      this.setState({TheName : e.target.value});
    }   

    PasswordonChange = (e) => {
      this.setState({ThePassword : e.target.value});
    }

    PasswordConfirmonChange = (e) => {
      this.setState({ThePasswordConfirm : e.target.value});
    }

   // UseronChange = (e) => {
   //   console.log('User1=' + e.target.value);
   //   let mystate = Object.assign({}, this.state);
   //   mystate.User = e.target.value;
   //   console.log('mystate.User = ' + mystate.User);
   //   this.setState({User : mystate.User});  
   // }

    onSubmit = (e) => {
      e.preventDefault();
        //if(this.state.ThePassword == this.state.ThePasswordConfirm){
        //}

      console.log("User = " + this.state.User + 
      ". UserName = " + this.state.TheName + 
      ". UserEmail = " + this.state.TheEmail + 
      ". UserPassword = " + this.state.ThePassword + 
      ". this.state.ThePasswordConfirm = " +  this.state.ThePasswordConfirm         
    );
      }
    


  render() {
    const { User, TheEmail, TheName, ThePassword, ThePasswordConfirm } = this.state;

    return (
      <Grid>
        <Jumbotron>
          <h1>Put your Phone to Work</h1>
          <p>Achieve your full potential</p>
        </Jumbotron>
        <Row className="text-center show-grid">
          <Col xs={12} md={8} className="show-grid text-centre">
            <br>
            </br>
            <br>
            </br>
            <br>
            </br>            
            <h3>As a user, pick projects to participate in, and have your phone work on these projects behind the scenes</h3>
          </Col>
          <Col xs={12} md={4} className="photophone">
            <Image src="assets/apple-camera-hand-7764 Cropped.jpg" circle className="thephotophone"/>
          </Col>
        </Row>
        <hr>
        </hr>
        <Row className = "text-center show-grid ">
          <Col xs={12} sm={4} className="photophone">
            <Image src="assets/art-computer-dark-193350.jpg" circle className="thephotophone"/>
          </Col>
          <Col xs={12} sm={8} className="show-grid">
          <br>
            </br>
            <br>
            </br>          
            <h3>As a Customer, submit your projects and have users from all over the worlld help you to achieve your goal</h3>
          </Col>
        </Row>
        <hr>
        </hr>
        <Panel id="uploadPanel" bsStyle = "info">
          <Panel.Heading>
            <Panel.Title toggle>
              Sign up
            </Panel.Title>
          </Panel.Heading>
          <Panel.Collapse>
            <Panel.Body>
              <form 
                onSubmit={this.onSubmit}
                >

                <FieldGroup
                  id="formControlsEmail"
                  type="email"
                  label="Email address"
                  placeholder="Enter email"
                  value = {this.state.TheEmail}
                  onChange={this.EmailonChange}
                />
                <FieldGroup
                  id="formControlsName"
                  type="text"
                  label="Pick a Username"
                  placeholder="Enter Username"
                  value = {this.state.TheName}
                  onChange={this.NameonChange}
                />                
                <FieldGroup
                  id="formControlsPassword" 
                  label="Password" 
                  type="password" 
                  value = {this.state.ThePassword}
                  onChange={this.PasswordonChange}                  
                />

                <FieldGroup
                  id="formControlsPasswordConfirm" 
                  label="Confirm Password" 
                  type="password"
                  value = {this.state.ThePasswordConfirm}
                  onChange={this.PasswordConfirmonChange}                    
                />


                <Button 
                  type="submit"
                  onClick = {() => {if (this.state.ThePassword != this.state.ThePasswordConfirm){
                    
                    //<Alert bsStyle="warning">
                      //<strong>Passwords not the same</strong> 
                      //Your password does not match your password confirmation.
                    //</Alert> 
                    alert("passwords do not match");
                  }}}
                  >
                  Submit</Button>
              </form>
            </Panel.Body>
          </Panel.Collapse>
        </Panel>

      </Grid>
      
    )
  }
}
