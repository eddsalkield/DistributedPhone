import * as React from "react";
import {Link} from "react-router-dom";

import * as obs from "@/obs";

import * as api from "../API";

import Button from "./Button";

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

    public componentDidMount() {
        for(const s of this.subs) s.start();
    }

    public componentWillUnmount() {
        for(const s of this.subs) s.stop();
    }

    private onToggle = () => {
        this.setState((st) => ({visible: !st.visible}));
    }

    private onNav = () => {
        this.setState({visible: false});
    }

    private onStop = () => {
        this.props.user.stop().then(() => {
            this.setState({visible: false});
        });
    }

    private onMenuClick = (ev: React.MouseEvent<HTMLElement>) => {
        ev.stopPropagation();
    }

    private onLogout = () => {
        this.setState({logging_out: true});
        this.props.user.logout().catch((e) => {
            this.setState({logging_out: false});
            // TODO: handle
        });
    }

    public render() {
        return <div className={"Navbar" + (this.state.visible ? " Navbar-visible" : "")}>
            <div className="Navbar-header">
                <Button type="button" className="Navbar-button" onClick={this.onToggle}>
                    <div></div>
                    <div></div>
                    <div></div>
                </Button>
                <span>Hello, {this.props.user.username}</span>
            </div>
            <div className="Navbar-overlay" onClick={this.onNav}><div className="Navbar-menu-box"><div className="Navbar-menu" onClick={this.onMenuClick} >
                <Link to="/" onClick={this.onNav}>Overview</Link>
                <Link to="/projects" onClick={this.onNav}>Projects</Link>
                <Link to="/settings" onClick={this.onNav}>Settings</Link>
                <a onClick={this.onStop} className={this.state.logging_out ? "inprogress" : ""}>Stop</a>
                <a onClick={this.onLogout} className={this.state.logging_out ? "inprogress" : ""}>Log out</a>
            </div></div></div>
        </div>;
    }
}
