import React, { Component } from 'react'
import { Link } from 'react-router-dom';

import { Jumbotron, Grid, Form, FormControl, FormGroup,ControlLabel, Panel, HelpBlock, Row, Col, Image, Button, Alert, Overlay } from 'react-bootstrap';
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

  //function WarningBanner(props) {
  //  if (!props.warn) {
  //    return null;
  //  }
  
  //  return (
  //    <div className="warning">
  //      Warning!
  //    </div>
  //  );
  //}  
  //<WarningBanner warn={(this.state.Password == this.state.PasswordConfirm)} />

  //function CustomPopover({ style }) {

  //target={() => ReactDOM.findDOMNode(this.target)}
  //                      <CustomPopover />

  export default class Home extends Component {
    constructor(props) {
      super(props);
      this.state = {
        TheEmail: '',
        TheName: '',
        ThePassword: '',
        ThePasswordConfirm: '',
        Password: '',
        PasswordConfirm: '',
        haveSignUp: false, 
        SignUpAttempt: false,  

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
        this.setState({Password: this.state.ThePassword})
        this.setState({PasswordConfirm: this.state.ThePasswordConfirm})
        if(this.state.ThePassword === this.state.ThePasswordConfirm){
          //when retrieving password for new user, must use ThePassword and not Password
        this.setState({SignUpAttempt: true})
        this.setState({haveSignUp: false});
        this.props.controller.SignUp(this.state.TheEmail, this.state.ThePassword).then(
          (SignUp) => {
              this.setState({
                  haveSignUp: true,
              });
          },
          (error) => {
              this.setState({
                  haveSignUp: true,
                  SignUpError: error.message,
              });
          },
        );
            

      console.log(
      ". UserName = " + this.state.TheName + 
      ". UserEmail = " + this.state.TheEmail + 
      ". UserPassword = " + this.state.ThePassword + 
      ". this.state.PasswordConfirm = " +  this.state.ThePasswordConfirm
    );
      }
    }

  

  render() {
    const { User, TheEmail, TheName, ThePassword, ThePasswordConfirm, Password, PasswordConfirm } = this.state;
    if(this.state.Password != this.state.PasswordConfirm){
      return (
        <Alert bsStyle="warning">
          <strong>Password did not match.</strong> Please try again   
          <br/>
          <Button onClick = {() => this.setState({Password:'',PasswordConfirm:'' })}>Try again </Button>
        </Alert>);
    }
    
    if ((!this.state.SignUpAttempt ||this.state.haveSignUp)){
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
                    //onClick = {() => {if (this.state.ThePassword != this.state.ThePasswordConfirm){
                      
                      //<Alert bsStyle="warning">
                        //<strong>Passwords not the same</strong> 
                        //Your password does not match your password confirmation.
                      //</Alert> 
                    //  alert("passwords do not match");
                   // }}}                  
                    >
                    Submit</Button>
                </form>
              </Panel.Body>
            </Panel.Collapse>
          </Panel>

        </Grid>
        
      )
    }
    if(this.state.SignUpError) {
      return <span class="errorMessage">{this.state.SignUpError}</span>;
    }
    //if(this.state.Password != this.state.PasswordConfirm){
    //  return <span class="errorMessage">{"passwords did not match"}</span>;
    //}
    return <img src="assets/loading.jpg" circle className="thephotophone"/>
  }
}
