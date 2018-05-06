import "@/polyfill";

import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import App from './App';

import {Controller, UIState} from "@/controller";

const ctl = new Controller("http://35.178.90.246/api/");

const uictl = new UIState(ctl);

ReactDOM.render(<App controller = {uictl}/>, document.getElementById('root'));

self.ctl = ctl;

self.stop = () => {
    ctl.resetExec().then(() => {
        console.log("Stopped");
    });
};

self.start = () => {
    ctl.startExec();
};
