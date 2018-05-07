import "@/polyfill";

import * as React from "react";
import {render} from "react-dom";

import App from "./App";
import {MockClientState} from "./API.ts"

let controller = new MockClientState();
render(<App controller = {controller}/>, document.getElementById("root"));
