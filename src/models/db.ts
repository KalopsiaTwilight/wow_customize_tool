import { ArmorSubclass, ItemRarity, SheatheStyle, WeaponSubclass } from "./item";

export interface ItemToDisplayIdData {
    itemId: number;
    inventoryType: number;
    itemName: string;
    itemDisplayId: number;
    iconFileId: number;
    rarity: ItemRarity;
    subClassId: ArmorSubclass | WeaponSubclass,
    sheatheType: SheatheStyle
};

export interface ModelResourceData {
    fileName: string, 
    filePath: string,
    fileId: number,
    modelResourceId: number,
    raceId: number,
    genderId: number,
    extraData: number
}

export interface ExtendedModelResourceData extends ModelResourceData {
    displayId: number
}

export interface TextureFileData {
    fileName: string, 
    fileId: number,
    filePath: string,
    genderId: number,
    raceId: number,
    classId: number,
    materialResourceId: number,
}

export interface IconFileData {
    fileId: number;
    fileName: string;
}

export interface DbResponse<T> {
    error?: Error,
    result?: T
  }