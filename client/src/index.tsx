import "@/polyfill";

import * as React from "react";
import {render} from "react-dom";

import {Controller, UIState} from "@/controller";
import Device from "@/dom_device";

import App from "./App";

import "./index.css";

const url = process.env.NODE_ENV === "production" ? "/api/" : "http://35.178.90.246/api/";

const ctl = new Controller(url, new Device());

const uictl = new UIState(ctl);

render(<App controller = {uictl}/>, document.getElementById("root"));

(self as any).ctl = ctl;

(self as any).reset = () => {
    ctl.reset();
};
