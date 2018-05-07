import * as React from "react";
import {HashRouter as Router, Route} from "react-router-dom";

import * as obs from "@/obs";

import * as api from "./API";

import Home from "./components/Home";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import Projects from "./components/Projects";
import Settings from "./components/Settings";

import "./App.css";

interface Props {
    controller: api.ClientState;
}
interface State {
    user: api.User | null | undefined;
}

class App extends React.Component<Props, State> {
    private readonly subs: obs.Subscription[];

    constructor(props: Props) {
        super(props);
        this.state = {
            user: undefined,
        };

        this.subs = [
            props.controller.user.subscribe((u) => this.setState({user: u})),
        ];
    }

    public componentDidMount() {
        for(const s of this.subs) s.start();
    }

    public componentWillUnmount() {
        for(const s of this.subs) s.stop();
    }

    public render() {
        const controller = this.props.controller;
        const user = this.state.user;
        if(user === undefined) return <div />;

        if(user === null) return <Login controller={controller} />;

        return <Router><div className="App">
            <Navbar user={user} />
            <Route exact path="/" render={(props) => <Home user={user} {...props} />} />
            <Route exact path="/projects" render={(props) => <Projects user={user} {...props} />} />
            <Route exact path="/settings"  render={(props) => <Settings user={user} {...props} />}/>
        </div></Router>;
    }
}

export default App;
