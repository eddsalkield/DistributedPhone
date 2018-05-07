import * as React from "react";

import * as obs from "@/obs";

import * as api from "../API";

import Form from "./Form";
import InCheckbox from "./InCheckbox";
import Loading from "./Loading";

import "./Settings.css";

interface Props {
    user: api.User;
}
interface State {
    set: api.Settings | undefined;
    projects: Map<string, api.Project> | undefined;
}

export default class Settings extends React.Component<Props, State> {
    private readonly subs: obs.Subscription[];

    constructor(props: Props) {
        super(props);
        this.state = {
            set: undefined,
            projects: undefined,
        };

        this.subs = [
            props.user.settings.subscribe((set) => {
                this.setState({set: set});
            }),
            props.user.projects.subscribe((p) => {
                this.setState({projects: p});
            }),
        ];
    } 

    componentDidMount() {
        for(const sub of this.subs) sub.start();
    }

    componentWillUnmount() {
        for(const sub of this.subs) sub.stop();
    }

    onChange = (name: string | undefined, value: boolean) => {
        this.props.user.updateSettings({[name as string]: value});
    }

    render() {
        if(this.state.set === undefined) {
            return <Loading />;
        }

        return <div className="Settings">
            <h2>Settings</h2>
            <Form className="Form-large">
                <InCheckbox name="allow_mobile_data" value={this.state.set.allow_mobile_data} onChange={this.onChange} >
                    <span>Allow mobile data usage</span>
                </InCheckbox>
                <InCheckbox name="allow_on_battery" value={this.state.set.allow_on_battery} onChange={this.onChange}>
                    <span>Allow working on battery</span>
                </InCheckbox>
            </Form>
        </div>;
    } 

}
