// Icônes des modules et de la navigation : chacune est un pictogramme du pack (voir Pictogrammes.jsx / PackIcones.jsx).
// Pour changer l'icône d'un module, changer la ligne correspondante. Seuls les 3 pictogrammes d'état de /statut sont dessinés ici.

export { IconMaison as IconTableauDeBord } from "./Pictogrammes";
export { IconEngrenage as IconParametres } from "./Pictogrammes";
export { IconCrochetDansBoite as IconPlanning } from "./Pictogrammes";
export { IconHorloge as IconHoraire } from "./Pictogrammes";
export { IconBoite as IconInventaire } from "./Pictogrammes";
export { IconDemandePack as IconDemande } from "./Pictogrammes";
export { IconPaniers as IconVentes } from "./Pictogrammes";
export { IconSac as IconCommandes } from "./Pictogrammes";
export { IconEclair as IconIntegration } from "./Pictogrammes";
export { IconFeuilleTempsPack as IconFeuilleTemps } from "./Pictogrammes";
export { IconCrochetDansBoite as IconTaches } from "./Pictogrammes";
export { IconMenuPack as IconMenu } from "./Pictogrammes";
export { IconThermometre as IconTemperature } from "./Pictogrammes";
export { IconNoteDeMusique as IconMusique } from "./Pictogrammes";
export { IconMessage as IconDiscussion } from "./Pictogrammes";
export { IconProfils as IconEmployes } from "./Pictogrammes";
export { IconProfils as IconEquipe } from "./Pictogrammes";
export { IconLocalisation as IconEmplacement } from "./Pictogrammes";

// IconTelephone existe déjà dans Pictogrammes.jsx (même nom) : on le ré-exporte tel quel.
export { IconTelephone } from "./Pictogrammes";

// Pictogrammes d'état de la page /statut (couleurs posées en CSS, voir .statut-icone).
export function IconEtatFonctionne(props) {
  return (
    <svg viewBox="0 0 1116 1116" fill="currentColor" fillRule="evenodd" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M557.85,0C865.736,0 1115.701,249.964 1115.701,557.85C1115.701,865.736 865.736,1115.701 557.85,1115.701C249.964,1115.701 0,865.736 0,557.85C0,249.964 249.964,0 557.85,0ZM467.22,951.367C434.817,951.888 403.088,935.296 385.749,905.263L251.76,673.188C226.309,629.105 241.435,572.653 285.518,547.202C329.6,521.751 386.053,536.877 411.504,580.959L467.22,677.462L736.856,210.438C762.307,166.355 818.76,151.229 862.842,176.68C906.925,202.131 922.051,258.583 896.6,302.666L548.69,905.263C531.351,935.296 499.622,951.888 467.22,951.367Z" />
    </svg>
  );
}

export function IconEtatNonFonctionnel(props) {
  return (
    <svg viewBox="0 0 995 995" fill="currentColor" fillRule="evenodd" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="matrix(1,0,0,1,-93.652284,-74.302638)">
        <path d="M590.938,74.303C865.398,74.303 1088.224,297.129 1088.224,571.589C1088.224,846.048 865.398,1068.874 590.938,1068.874C316.479,1068.874 93.652,846.048 93.652,571.589C93.652,297.129 316.479,74.303 590.938,74.303ZM489.472,571.589L308.263,390.379C280.262,362.379 280.262,316.913 308.263,288.913C336.263,260.913 381.728,260.913 409.729,288.913L590.938,470.123L772.148,288.913C800.148,260.913 845.613,260.913 873.614,288.913C901.614,316.913 901.614,362.379 873.614,390.379L692.404,571.589L873.614,752.798C901.614,780.798 901.614,826.264 873.614,854.264C845.613,882.264 800.148,882.264 772.148,854.264L590.938,673.055L409.729,854.264C381.728,882.264 336.263,882.264 308.263,854.264C280.262,826.264 280.262,780.798 308.263,752.798L489.472,571.589Z" />
      </g>
    </svg>
  );
}

export function IconEtatProbleme(props) {
  return (
    <svg viewBox="0 0 973 973" fill="currentColor" fillRule="evenodd" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="matrix(1,0,0,1,-183.434640,-165.633)">
        <path d="M669.885,165.633C938.364,165.633 1156.335,383.604 1156.335,652.083C1156.335,920.562 938.364,1138.533 669.885,1138.533C401.406,1138.533 183.435,920.562 183.435,652.083C183.435,383.604 401.406,165.633 669.885,165.633ZM669.885,776.151C634.936,776.151 610.084,771.491 595.327,762.172C580.571,752.852 571.64,741.008 568.533,726.64C565.427,712.273 563.873,697.322 563.873,681.79L563.873,338.127C563.873,322.594 565.427,307.449 568.533,292.693C571.64,277.937 580.571,265.705 595.327,255.997C610.084,246.289 635.324,241.435 671.05,241.435C706.775,241.435 731.822,246.289 746.19,255.997C760.557,265.705 769.295,278.131 772.401,293.276C775.508,308.42 777.061,323.759 777.061,339.292L777.061,682.954C777.061,698.487 775.508,713.438 772.401,727.805C769.295,742.173 760.363,753.823 745.607,762.754C730.851,771.686 705.61,776.151 669.885,776.151ZM669.885,1062.731C624.84,1062.731 594.939,1053.994 580.183,1036.519C565.427,1019.045 558.049,990.115 558.049,949.73C558.049,932.644 559.796,915.558 563.291,898.472C566.786,881.386 576.3,867.212 591.832,855.951C607.365,844.69 633.771,839.059 671.05,839.059C716.871,839.059 746.772,847.602 760.752,864.688C774.731,881.774 781.721,910.898 781.721,952.06C781.721,969.146 780.168,986.232 777.061,1003.318C773.954,1020.404 764.635,1034.578 749.102,1045.839C733.569,1057.1 707.163,1062.731 669.885,1062.731Z" />
      </g>
    </svg>
  );
}

export { IconCrayon } from "./Pictogrammes";
