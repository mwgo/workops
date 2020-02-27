import { IIconProps } from "azure-devops-ui/Icon";

interface IIconPropsMap {
    [key: string]: IIconProps;
}

export class Styles {

    static TypesMap: IIconPropsMap = {
        "": { iconName: "SkypeCircleCheck" },
        "Feature": { iconName: "Trophy2Solid", style: { color: "#773B93"} },
        "Bug": { iconName: "LadybugSolid", style: { color: "#CC293D"} }, 
        "Task": { iconName: "TaskSolid", style: { color: "#F2CB1D"} },
        "User Story": { iconName: "ReadingModeSolid", style: { color: "#009CCC"} }
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

}