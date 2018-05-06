import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Jumbotron, Grid, Button, PanelGroup, Panel, Checkbox, Radio, FormGroup, FormControl, ControlLabel, HelpBlock } from 'react-bootstrap';
import './Customer.css';


function FieldGroup({ id, label, help, ...props }) {
    return (
      <FormGroup controlId={id}>
        <ControlLabel>{label}</ControlLabel>
        <FormControl {...props} />
        {help && <HelpBlock>{help}</HelpBlock>}
      </FormGroup>
    );
  }

  
export default class Customer extends Component {
  constructor(props) {
   super(props);
    this.state = {
      haveProjects: false,
    };
  }

  componentDidMount() {
    this.refreshProjects();
  }

  refreshProjects() {
      this.setState({haveProjects: false});
      console.log(this.props.controller.ListOfAllProjects());
      this.props.controller.ListOfAllProjects().then(
        (listOfAllProjects) => {
            this.setState({
                projects: listOfAllProjects,
                haveProjects: true,
            });
        },
        (error) => {
            this.setState({
                haveProjects: true,
                projectListError: error.message,
            });
        },
      );
    }

  render() {
    if(this.state.haveProjects) {
        let AllProjectRows = [];
        for(var i = 0; i < this.state.projects.length; i++) {
          AllProjectRows.push(
          <Panel eventKey={i} bsStyle = "info" key= {i}>
              <Panel.Heading>
                   <Panel.Title toggle>{this.state.projects[i].Title}</Panel.Title>
              </Panel.Heading>
              <Panel.Body collapsible>
                <p>
                  {this.state.projects[i].Description}
                </p>
        
              </Panel.Body>
          </Panel>);
        }

        return (    
          <Grid>
             <Jumbotron>
              <h2>Put your phone to work!</h2>
              <p>Add your own project, people all over the world will be able to contribute their supluss processing power</p>
            </Jumbotron> 
            <Panel id="uploadPanel" bsStyle = "info">
              <Panel.Heading>
                <Panel.Title toggle>
                  Upload your own project!
                </Panel.Title>
              </Panel.Heading>
              <Panel.Collapse>
                <Panel.Body>
                  Insert description of how to upload a project here
                </Panel.Body>
              </Panel.Collapse>
            </Panel>
    
         <h2>All projects </h2>
            <PanelGroup accordion id="accordion" defaultActiveKey={0}>
             {AllProjectRows} 
           </PanelGroup> 
          <div>
          </div> 
    
        </Grid>
        );
    }
    if(this.state.projectListError) {
        return <span class="errorMessage">{this.state.projectListError}</span>;
    }
    return <img src="assets/loading.jpg" circle className="thephotophone"/>


    } 

}
