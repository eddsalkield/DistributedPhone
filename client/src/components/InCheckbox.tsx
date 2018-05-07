import * as React from 'react'

import "./Input.css";

interface Props {
    className?: string;
    name?: string;
    value?: boolean;
    onChange?: (name: string | undefined, data: boolean) => void;
}

export default class InCheckbox extends React.Component<Props> {
    render() {
        const {className, name, value, onChange, children} = this.props;

        return <label className={(className || "") + " Input InCheckbox"}>
            <div>{children}</div>
            <input
                type="checkbox"
                name={name}
                checked={value}
                onChange={onChange ? (ev) => onChange(name, ev.target.checked) : undefined}
            />
        </label>;
    }
}
