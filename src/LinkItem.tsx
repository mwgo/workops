import { Button } from "azure-devops-ui/Button";
import { ListSelection } from "azure-devops-ui/List";
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
    name: string;
    title: string;
    url: string;
}

// vstfs:///Git/Commit/a86b1277-1813-42fb-81b6-023cf4f8f82b%2f50a99e50-41a3-4f2c-b11b-8a4b71b9f4cf%2fc696e15d204c454f7343f91c11e10edd4b69c593'
// vstfs:///Git/PullRequestId/a86b1277-1813-42fb-81b6-023cf4f8f82b%2F50a99e50-41a3-4f2c-b11b-8a4b71b9f4cf%2F4538
// vstfs:///Git/Ref/.....

export class LinkItem extends React.Component<ILinkItemProps, ILinkItemState> {

    constructor(props: ILinkItemProps) {
        super(props);

        let info = this.props.Data.LinksInfo[this.props.Link];
        this.state = { 
            name: info ? info.name : "",
            title: info ? info.title : "",
            url: info ? info.url : ""
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
        let info = this.props.Data.LinksInfo[this.props.Link];
        if (info && info.name!=this.state.name)
            this.setState(info);
    }

    public render(): JSX.Element {
        if (!this.state.name) return (<span/>);

        return (
            <Button 
                iconProps={ { iconName: this.props.Icon, style: { color: "#000000"} } }
                text={ this.state.name }
                href={ this.state.url ? this.state.url : undefined }
                target="_top"
                tooltipProps={ { text: this.state.title } }
                className="linkitem_text"
            />
        );
    }

}

