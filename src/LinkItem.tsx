import { Button } from "azure-devops-ui/Button";
import "es6-promise/auto";
import * as React from "react";
import { Data } from "./Data";

interface ILinkItemProps {
    ID: number;
    Data: Data;
    Link: string;
    Icon: string;
}

interface ILinkItemState {
    Info?: string;
}

// vstfs:///Git/Commit/a86b1277-1813-42fb-81b6-023cf4f8f82b%2f50a99e50-41a3-4f2c-b11b-8a4b71b9f4cf%2fc696e15d204c454f7343f91c11e10edd4b69c593'
// vstfs:///Git/PullRequestId/a86b1277-1813-42fb-81b6-023cf4f8f82b%2F50a99e50-41a3-4f2c-b11b-8a4b71b9f4cf%2F4538

export class LinkItem extends React.Component<ILinkItemProps, ILinkItemState> {

    constructor(props: ILinkItemProps) {
        super(props);

        this.state = { 
            Info: this.props.Data.LinksInfo[this.props.Link] 
        };
    }

    componentDidMount(): void {
        this.props.Data.LinkItems.push(this);
    }

    componentWillUnmount(): void {
        let idx = this.props.Data.LinkItems.indexOf(this);
        if (idx>=0) this.props.Data.LinkItems.splice(idx, 1);
    }

    update(): void {
        let link = this.props.Data.LinksInfo[this.props.Link];
        if (link!==this.state.Info)
            this.setState({ 
                Info: link
            });
    }

    public render(): JSX.Element {
        if (this.state.Info===undefined) return (<span/>);

        return (
            <Button 
                iconProps={ { iconName: this.props.Icon, style: { color: "#000000"} } }
                text={ this.state.Info }
                />
        );
    }

}

