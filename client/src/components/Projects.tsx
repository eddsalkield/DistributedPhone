import * as React from "react";
import {Link} from "react-router-dom";

import * as obs from "@/obs";

import * as api from "../API";

import InCheckbox from "./InCheckbox";
import Loading from "./Loading";

import "./Projects.css";

interface Props {
    user: api.User;
}

interface State {
    projects: api.Project[] | undefined;
    enabled: Set<string> | undefined;
}

export default class Projects extends React.Component<Props, State> {
    private readonly subs: obs.Subscription[];

    constructor(props: Props) {
        super(props);
        this.state = {
            projects: undefined,
            enabled: undefined,
        };

        this.subs = [
            props.user.settings.subscribe((set) => {
                this.setState({enabled: new Set(set.projects)});
            }),
            props.user.projects.subscribe((p) => {
                this.setState({projects: Array.from(p.values())});
            }),
        ];
    }

    public componentDidMount() {
        for(const sub of this.subs) sub.start();
    }

    public componentWillUnmount() {
        for(const sub of this.subs) sub.stop();
    }

    private onSet = (name: string, value: boolean) => {
        const enabled = this.state.enabled!;
        if(value) {
            if(!enabled.has(name)) {
                this.props.user.setProjectOn(name);
            }
        } else {
            if(enabled.has(name)) {
                this.props.user.setProjectOff(name);
            }
        }
    }

    private onRefresh = () => {
        this.props.user.refreshProjects();
    }

    public render() {
        const {projects, enabled} = this.state;
        if(projects === undefined || enabled === undefined) {
            return <Loading />;
        }

        return <div className="Main Projects">
            <h2>
                Projects
                <a className="Projects-refresh" onClick={this.onRefresh}>{refresh_icon}</a>
            </h2>
            {projects.map((p) => <Project key={p.id} data={p} enabled={enabled.has(p.id)} onSet={this.onSet} />)}
        </div>;
    }
}

interface ProjProps {
    data: api.Project;
    enabled: boolean;
    onSet: (id: string, value: boolean) => void;
}

// tslint:disable-next-line:max-line-length
const refresh_icon = <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M9 13.5c-2.49 0-4.5-2.01-4.5-4.5S6.51 4.5 9 4.5c1.24 0 2.36.52 3.17 1.33L10 8h5V3l-1.76 1.76C12.15 3.68 10.66 3 9 3 5.69 3 3.01 5.69 3.01 9S5.69 15 9 15c2.97 0 5.43-2.16 5.9-5h-1.52c-.46 2-2.24 3.5-4.38 3.5z"/></svg>;

class Project extends React.Component<ProjProps> {
    private onChange = (name: string | undefined, value: boolean) => {
        this.props.onSet(this.props.data.id, value);
    }

    public render() {
        const p = this.props.data;
        return <div className="Projects-Project">
            <InCheckbox value={this.props.enabled} onChange={this.onChange}>
                <h4>{p.title}</h4>
            </InCheckbox>
            <Link to={`/project/${p.id}`}>Project stats</Link>
            <p>{p.description}</p>
        </div>;
    }
}
