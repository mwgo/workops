import { IIconProps } from "azure-devops-ui/Icon";

interface IIconPropsMap {
    [key: string]: IIconProps;
}

export class Styles {

    static LoadingIcon: IIconProps = { iconName: "ProgressRingDots", style: { color: "#000000"} };

    static ErrorIcon: IIconProps = { iconName: "Error", style: { color: "#ff0000"} };

    static AreaIcon: IIconProps = { iconName: "StatusCircleInner", style: { color: "#000000"} };

    static PrIcon: IIconProps = { iconName: "BranchPullRequest", style: { color: "#000000"} };

    static LinkBranchIconName = "BranchFork2";

    static LinkTargetBranchIconName = "ChevronRightMed";

    static LinksIcon: { [lisk: string]: string } = {
        "pr": "BranchPullRequest",
        "prbranch": "BranchFork2",
        "commit" : "BranchCommit",
        "branch" : "BranchFork2"
    };

    static TypesMap: IIconPropsMap = {
        "": { iconName: "SkypeCircleCheck" },
        "Feature": { iconName: "Trophy2Solid", style: { color: "#773B93"} },
        "Bug": { iconName: "LadybugSolid", style: { color: "#CC293D"} }, 
        "Task": { iconName: "TaskSolid", style: { color: "#F2CB1D"} },
        "User Story": { iconName: "ReadingModeSolid", style: { color: "#009CCC"} },
        "Impediment": { iconName: "ConstructionConeSolid", style: { color: "#CC293D"} }
    };

    static StatesMap: IIconPropsMap = {
        "": { iconName: "StatusCircleInner", style: { color: "#000000"} },
        "New": { iconName: "StatusCircleInner", style: { color: "#b2b2b2"} },
        "Active": { iconName: "StatusCircleInner", style: { color: "#007acc"} },
        "Ready": { iconName: "StatusCircleInner", style: { color: "#007acc"} },
        "Completed": { iconName: "StatusCircleInner", style: { color: "#5688e0"} },
        "Resolved": { iconName: "StatusCircleInner", style: { color: "#5688e0"} },
        "Closed": { iconName: "StatusCircleInner", style: { color: "#339933"} },
        "Removed": { iconName: "StatusCircleRing", style: { color: "#b2b2b2"} },
    };

    static PrStateActive: IIconProps = { iconName: "StatusCircleInner", style: { color: "#007acc"} };
    static PrStateCompleted: IIconProps = { iconName: "StatusCircleInner", style: { color: "#339933"} };
    static PrStateWaiting: IIconProps = { iconName: "StatusCircleInner", style: { color: "#d67f3c"} };
    static PrStateRejected: IIconProps = { iconName: "StatusCircleInner", style: { color: "#cd4a45"} };
}