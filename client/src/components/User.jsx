import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Jumbotron, Grid, Button, PanelGroup, Panel, Checkbox, Radio, FormGroup, FormControl, ControlLabel, Alert } from 'react-bootstrap';
import './User.css';
import navigationBar from './navigationBar'
import * as API from'../API.ts'








export default class User extends Component {

    constructor(props) {
        super(props);
        this.state = {
             OnlyWhenCharging : '',
             AllowDataUsage : '',
             CurrentProjectID : '',
             ProcessingPowerAllowance : '',  
             AddingProject: '', 
             haveAllProjects: false,
             haveMyProjects: false,             
        };
        this.onSubmit = this.onSubmit.bind(this); 
      } 

      componentDidMount() {
        this.refreshAllProjects();
        this.refreshMyProjects();
      }
      
      ChargingonChange = (e) => {
        this.setState({OnlyWhenCharging : e.target.value});
      }

      DataonChange = (e) => {
        this.setState({AllowDataUsage : e.target.value});
      }

      ProjectonChange = (e) => {
        this.setState({CurrentProjectID : e.target.value});
      }      

      PoweronChange = (e) => {
        this.setState({ProcessingPowerAllowance : e.target.value});
      }  

      AddingProjectonChange = (e) => {
        this.setState({AddingProject: e.target.value});
      }

      onSubmit = (e) => {
        e.preventDefault();


 
        console.log(
            ". OnlyWhenCharging = " + this.state.OnlyWhenCharging + 
            ". AllowDataUsage = " + this.state.AllowDataUsage + 
            ". CurrentProjectID = " + this.state.CurrentProjectID +             
            ". AddingProject = " + this.state.AddingProject
        )  
      }

      refreshAllProjects() {
        this.setState({haveAllProjects: false, allprojectListError: undefined});
        this.props.controller.ListOfAllProjects().then(
          (listOfAllProjects) => {
              this.setState({
                  projects: listOfAllProjects,
                  haveAllProjects: true,
              });
          },
          (error) => {
              this.setState({
                  allprojectListError: error.message,
              });
          },
        );
      }

      refreshMyProjects() {
        this.setState({haveMyProjects: false, myprojectListError: undefined});
        this.props.controller.ListOfMyProjects().then(
          (listOfMyProjects) => {
              this.setState({
                  myprojects: listOfMyProjects,
                  haveMyProjects: true,
              });
          },
          (error) => {
              this.setState({
                  myprojectListError: error.message,
              });
          },
        );
      }

    
  render() {
    console.log("Render", this.state);

    const {ProcessingPowerAllowance, CurrentProjectID, OnlyWithWifi, OnlyWhenCharging, AddingProject} = this.state;

    if (!this.props.controller.IsLoggedIn)
        return (
              <Alert bsStyle="warning">
                <strong>Not Logged In</strong> Log in to access this page
                <br/>
                <Button onClick = {() => this.setState({Password:'',PasswordConfirm:'' })}>Try again </Button>
              </Alert>);

    if(this.state.allprojectListError) {
        return <span class="errorMessage">{this.state.allprojectListError}</span>;
    }

    if(this.state.myprojectListError) {
        return <span class="errorMessage">{this.state.myprojectListError}</span>;
    }

    if(this.state.haveAllProjects && this.state.haveMyProjects && this.props.controller.IsLoggedIn) {
        var ProjectListIDs = [];
        for (var n = 0; n < this.state.myprojects.length; n++){
            ProjectListIDs[n] = this.state.myprojects[n].Title
        }
        
        var PanelRows = [];
        for (var i = 0; i < this.state.myprojects.length; i++) {
            PanelRows.push(
            <Panel eventKey={i} bsStyle = "info" key = {i}>
                <Panel.Heading>
                     <Panel.Title toggle>{this.state.myprojects[i].Title}</Panel.Title>
                </Panel.Heading>
                <Panel.Body collapsible>{this.state.myprojects[i].Description}</Panel.Body>
            </Panel>);
        }

        var theoptionrows = [];
        theoptionrows.push (<option value={null} key = {-1}>{"No Project"}</option> )
        for (var i = 0; i < this.state.myprojects.length; i++) {
            theoptionrows.push(
                <option value={this.state.myprojects[i].index} key = {i}>{this.state.myprojects[i].Title}</option>
            )
        };

        var theuseroptionrows = [];
        theuseroptionrows.push(<option value={null} key = {-1}>{"None"}</option>)
        for (var i = 0; i < this.state.projects.length; i++) {
            if(!(ProjectListIDs.includes(this.state.projects[i].Title))){ 
            theuseroptionrows.push(
                <option value={this.state.projects[i].index} key = {i}>{this.state.projects[i].Title}</option>
            )
            }
        };
    }


    return (
      <Grid>
        <Jumbotron>
          <h2>Put your phone to work!</h2>
          <p>Dedicate some of your processing power to other projects, and enjoy the same speeds as always</p>
        </Jumbotron>

   
        <Panel id="SettingsPanel" bsStyle = "info">
          <Panel.Heading>
            <Panel.Title toggle>
              Customise (settings)
            </Panel.Title>
          </Panel.Heading>
          <Panel.Collapse>
            <Panel.Body>
                 <form onSubmit = {this.onSubmit}>
                    <FormGroup>
                        <p>
                            <ControlLabel>
                                Only allow when charging?
                            </ControlLabel>
                        </p>
                        <Radio 
                            name="Charging" 
                            inline
                            value = {true}
                            onChange= {this.ChargingonChange} 
                            >
                            Yes

                        </Radio>{' '}
                        <Radio 
                            name="Charging" 
                            inline
                            value = {false}
                            onChange= {this.ChargingonChange}                            
                            >
                            No
                            
                        </Radio>
                    </FormGroup>

                    <FormGroup>
                        <p>
                            <ControlLabel>
                                Allow mobile data usage?
                            </ControlLabel>
                        </p>
                        <Radio 
                            name="Data" 
                            inline
                            value = {true}
                            onChange= {this.DataonChange}                           
                            >
                            Yes
                        </Radio>{' '}
                        <Radio 
                        name="Data" 
                        inline
                        value = {false}
                        onChange= {this.DataonChange}                         
                        >
                            No
                        </Radio>
                    </FormGroup>

                    <FormGroup controlId="Project Choice">
                        <ControlLabel>Which project would you like to work on?</ControlLabel>
                        <FormControl 
                            componentClass="select" 
                            value = {this.state.CurrentProjectID}
                            onChange = {this.ProjectonChange}
                            >
                            {theoptionrows}
                        </FormControl>
                    </FormGroup>

                    <FormGroup controlId="Adding projects">
                        <ControlLabel>Add project to your list of projects</ControlLabel>
                        <FormControl 
                            componentClass="select" 
                            value = {this.state.AddingProject}
                            onChange = {this.AddingProjectonChange}
                            >
                            {theuseroptionrows}
                        </FormControl>
                    </FormGroup>

                    <Button type="submit">Submit</Button>
                </form>  
            </Panel.Body>
          </Panel.Collapse>
        </Panel>




        <h2>My projects</h2>
            <div>
                <PanelGroup accordion id="loopAccordianUserProjects" defaultActiveKey={0}>
                    {PanelRows} 
                </PanelGroup> 
            </div>


       

    </Grid>
    )

    return <img src="assets/loading.jpg" circle className="thephotophone"/>

    } 

}
