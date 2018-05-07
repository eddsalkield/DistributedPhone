import "@/polyfill";

import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import {ClientState} from './API.ts'


let controller = new ClientState();

ReactDOM.render(<App controller = {controller}/>, document.getElementById('root'), );



