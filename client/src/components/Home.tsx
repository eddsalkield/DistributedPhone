import * as React from "react";

import * as obs from "@/obs";

import * as api from "../API";

import Logo from "./Logo";

import "./Home.css";

interface Props {
    user: api.User;
}
interface State {
    overview: string[];
}

export default class Home extends React.Component<Props, State> {
    private readonly subs: obs.Subscription[];

    constructor(props: Props) {
        super(props);
        this.state = {
            overview: [],
        };

        this.subs = [
            props.user.overview.subscribe((v) => {
                this.setState({overview: v});
            }),
        ];
    }

    public componentDidMount() {
        for(const s of this.subs) s.start();
    }

    public componentWillUnmount() {
        for(const s of this.subs) s.stop();
    }

    public render() {
        const {overview} = this.state;

        return <div className="Main Home">
            <h1><Logo /></h1>
            {overview.map((t) => <p>{t}</p>)}
        </div>;
    }
}
