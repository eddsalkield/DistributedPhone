import * as React from "react";
import {Link} from "react-router-dom";

import * as obs from "@/obs";

import * as api from "../API";

import "./Navbar.css";

interface Props {
    user: api.User;
}

interface State {
    logging_out: boolean;
    visible: boolean;
}

export default class Navbar extends React.Component<Props, State> {
    private readonly subs: obs.Subscription[];

    constructor(props: Props) {
        super(props);
        this.state = {
            logging_out: false,
            visible: false,
        };

        this.subs = [];
    }

    componentDidMount() {
        for(const s of this.subs) s.start();
    }

    componentWillUnmount() {
        for(const s of this.subs) s.stop();
    }

    onToggle = (e: React.FormEvent<HTMLInputElement>) => {
        this.setState({visible: (e.target as HTMLInputElement).checked});
    };

    onNav = () => {
        this.setState({visible: false});
    };

    onStop = () => {
        this.props.user.stop().then(() => {
            // TODO
        });
    };

    onLogout = () => {
        this.setState({logging_out: true})
        this.props.user.logout().catch((e) => {
            this.setState({logging_out: false});
            // TODO: handle
        });
    };

    render() {
        return <div className="Navbar">
            <div className="Navbar-header">
                <input type="checkbox" className="Navbar-button" checked={this.state.visible} onChange={this.onToggle} />
                <span>Hello, {this.props.user.username}</span>
            </div>
            <div className={"Navbar-menu" + (this.state.visible ? " visible" : "")}>
                <Link to="/" onClick={this.onNav}>Overview</Link>
                <Link to="/projects" onClick={this.onNav}>Projects</Link>
                <Link to="/settings" onClick={this.onNav}>Settings</Link>
                <a onClick={this.onStop} className={this.state.logging_out ? "inprogress" : ""}>Stop</a>
                <a onClick={this.onLogout} className={this.state.logging_out ? "inprogress" : ""}>Log out</a>
            </div>
        </div>;
    }
}
