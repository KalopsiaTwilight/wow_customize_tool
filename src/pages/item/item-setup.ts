import { debounce } from "../../utils";

import { onInventorySlotChange } from "./item-inventoryslot";
import { onAddTexture, onSearchTexture, reloadTextures } from "./item-texture";
import { exportToFile, loadFile, loadItem, onRandomizeItem, onSearchItem } from "./item-loading";
import { onAddComponentTexture, onRandomizeComponent1Texture, onRandomizeComponent2Texture, onSearchComponentTexture, reloadComponentTextures } from "./item-component-textures";
import { onAddComponentModel, onRandomizeComponent1Model, onRandomizeComponent2Model, onSearchComponentModel, reloadComponentModels } from "./item-component-models";
import { onSetParticleColors, reloadParticleColorComponents } from "./item-particle-colors";
import { onAddGeoSetOverride, reloadHelmetGeovisComponents } from "./item-helmet-geovis";
import { reloadFlagsComponents } from "./item-feature-flags";
import { reloadGeosetDisplay } from "./item-geoset-display";
import { onModelGenderChange, onModelRaceChange, reloadCharacterModel } from "./character-model";

$(async function () {
    $("#ci_inventoryslot").on("change", onInventorySlotChange);

    $("#ci_texture_textureFile").on("keyup", debounce(onSearchTexture));
    $("#addTextureBtn").on("click", onAddTexture);

    $("#ci_item_search").on("keyup", debounce(onSearchItem));
    $("#loadItemBtn").on("click", loadItem);

    $("#component1AddModelBtn").on("click", function () {
        $("#ci_component_id").val("0")
    });
    $("#component1AddTextureBtn").on("click", function () {
        $("#ci_component_id").val("0")
    });
    $("#component2AddModelBtn").on("click", function () {
        $("#ci_component_id").val("1")
    });
    $("#component2AddTextureBtn").on("click", function () {
        $("#ci_component_id").val("1")
    });

    $("#ci_componenttexture_file").on("keyup", debounce(onSearchComponentTexture));
    $("#ci_componentmodel_modelfile").on("keyup", debounce(onSearchComponentModel));

    $("#addComponentTextureBtn").on("click", onAddComponentTexture);
    $("#addComponentModelBtn").on("click", onAddComponentModel);

    $("#setParticleOverride").on("click", onSetParticleColors);

    $("#addHelmetGeoVis").on("click", onAddGeoSetOverride);

    $("#exportBtn").on("click", exportToFile);
    $("#loadFileBtn").on("click", loadFile);

    $("#ci_model_gender").on("change", onModelGenderChange)
    $("#ci_model_race").on("change", onModelRaceChange)

    $("#randomizeItemBtn").on("click", onRandomizeItem)

    $("#component1RandomizeModelBtn").on("click", onRandomizeComponent1Model);
    $("#component2RandomizeModelBtn").on("click", onRandomizeComponent2Model);
    $("#component1RandomizeTextureBtn").on("click", onRandomizeComponent1Texture);
    $("#component2RandomizeTextureBtn").on("click", onRandomizeComponent2Texture);

    $("#patchWoWBtn").on("click", () => {
        $.LoadingOverlay("show");
        window.api.applyItemPatch("My Awesome Item").then((output) => {
            $.LoadingOverlay("hide");
            if (output.resultCode != 0) {
                $("#alertError")
                    .empty()
                    .append("Something went wrong applying the patch to the WoW clientfiles. Please contact a developer for help!")
                    .show();
            } else {
                $("#alertError")
                    .empty()
                    .hide();
            }
        });
    });

    const itemData = await window.store.get('itemData');
    await reloadAllSections(itemData.inventoryType)

    // Load character
    const defaultChar = await window.store.get('previewCharacter');
    $("#ci_model_gender").val(defaultChar.gender);
    $("#ci_model_race").val(defaultChar.race);
    reloadCharacterModel(defaultChar);
    $(window).on("resize", debounce(() => {
        const currentRace = parseInt($("#ci_model_race").val().toString(), 10);
        const currentGender = parseInt($("#ci_model_gender").val().toString(), 10);
        if (currentGender != defaultChar.gender || currentRace != defaultChar.race) {
            reloadCharacterModel({
                race: currentRace,
                gender: currentGender,
                customizations: []
            });
        } else {
            reloadCharacterModel(defaultChar);
        }
    }));
})


export async function reloadAllSections(inventorySlot: number) {
    $("#ci_inventoryslot").val(inventorySlot);
    await reloadGeosetDisplay();
    await reloadTextures();
    await reloadComponentModels();
    await reloadComponentTextures();
    await reloadParticleColorComponents();
    await reloadFlagsComponents();
    await reloadHelmetGeovisComponents();
}