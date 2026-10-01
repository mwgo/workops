import * as React from "react";
import { Button } from "azure-devops-ui/Button";

interface IMarkReadButtonProps {
    onMarkRead: () => void;
}

export function MarkReadButton(props: IMarkReadButtonProps): JSX.Element {
    return (
        <Button
            iconProps={ { iconName: "CheckMark" } }
            subtle={true}
            tooltipProps={ { text: "Mark as read" } }
            ariaLabel="Mark as read"
            className="linkitem_text"
            onClick={event => {
                event.stopPropagation();
                event.preventDefault();
                props.onMarkRead();
            }}
        />
    );
}
