import * as React from "react";

import * as api from "../API";

import "./Home.css";

interface Props {
    user: api.User;
}
interface State {
}

export default class Home extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {};
    }

    render() {
        return <div className="Home">
            <h1>Put your Phone to Work</h1>
            <p>Achieve your full potential</p>
        </div>;
    }
}
