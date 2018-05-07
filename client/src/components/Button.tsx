import * as React from "react";

import "./Input.css";

interface Props {
    type: string;
    className?: string;
    onClick?: () => void;
}

export default class Button extends React.Component<Props> {
    public render() {
        const {type, onClick, children} = this.props;

        return <button
            type={type}
            className={(this.props.className || "") + " Input Button"}
            onClick={onClick ? (ev) => onClick() : undefined}
        >
            {children}
        </button>;
    }
}
