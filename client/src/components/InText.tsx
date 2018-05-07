import * as React from 'react'

import "./Input.css";

interface Props {
    className?: string;
    name?: string;
    desc: string;
    type?: string;
    value?: string;
    onChange?: (name: string | undefined, data: string) => void;
}
interface State {
    focus: boolean;
}

export default class InText extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            focus: false,
        };
    }

    onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        this.setState({focus: true});
    };

    onUnfocus = (e: React.FocusEvent<HTMLInputElement>) => {
        this.setState({focus: false});
    };

    render() {
        const {className, type, name, value, onChange, desc} = this.props;

        return <label className={(className || "") + " Input InText" + (this.state.focus ? " InText-focus" : "")}>
            <div><span>{desc}</span></div>
            <input
                type={type || "text"}
                name={name}
                value={value}
                onInput={onChange ? (ev) => onChange(name, (ev.target as HTMLInputElement).value) : undefined}
                placeholder={desc}
                onFocus={this.onFocus}
                onBlur={this.onUnfocus}
            />
        </label>;
    }
}
