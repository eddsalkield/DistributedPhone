import * as React from "react";

import "./Form.css";

interface Props {
    error: string | null;
}

export default class FormError extends React.Component<Props> {
    public render() {
        return <div className={"FormError" + (this.props.error === null ? "" : " FormError-error")}>
            {this.props.error === null ? null :
                <span>{this.props.error}</span>
            }
        </div>;
    }
}
