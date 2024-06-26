import "@fortawesome/fontawesome-free/js/all";
import 'gasparesganga-jquery-loading-overlay'
import './shared/app.scss';
import { OnFirstStartChannel } from "./ipc/channels";

import { loadPage as loadItemPage, unloadPage as unloadItemPage} from "./pages/item"
import { loadPage as loadPrefPage } from "./pages/preferences"


window.jQuery = $;
window.$ = $;

import * as bootstrap from 'bootstrap'

$.LoadingOverlaySetup({
    background: "rgba(190,190,190, 0.8)"
});

let currentPage = "#item";

$(async function () {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    tooltipTriggerList.forEach(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

    const pref = await window.store.get('settings');
    setTheme(pref.useDarkMode);
    
    window.ipcRenderer.on(OnFirstStartChannel, (_, obj: any) => {
        const modal = bootstrap.Modal.getOrCreateInstance($("#firstTimeConfigModal")[0]);
        $("#ftc_wowPath").val(obj.suggestedDir);
        if (obj.launchWoWAfterPatch) {
            $("#ftc_launchWoWAfterPatch").attr('checked', 'true');
        }
        $("#ftc_model_race").val(obj.previewCharacter.race);
        $("#ftc_model_gender").val(obj.previewCharacter.gender);
        modal.show();
    });

    $("#ftc_openFolder").on("click", async function () {
        const folders = await window.api.selectFolder();
        if (folders) {
            $("#ftc_wowPath").val(folders[0]);
        }
    })

    $("#setFirstTimeConfig").on("click", async function () {
        const pref = await window.store.get('settings');
        pref.freedomWoWRootDir = $("#ftc_wowPath").val().toString();
        pref.launchWoWAfterPatch = $("#ftc_launchWoWAfterPatch").is(':checked');
        pref.previewCharacter.gender = parseInt($("#ftc_model_gender").val().toString());
        pref.previewCharacter.race = parseInt($("#ftc_model_race").val().toString());

        $("#ci_model_race").val($("#ftc_model_race").val())
        $("#ci_model_gender").val($("#ftc_model_gender").val())

        $("#ci_model_race").trigger('change');
        await window.store.set("settings", pref);
    })

    $("#toggleThemeBtn").on("click", async function () {
        const pref = await window.store.get('settings');
        pref.useDarkMode = !pref.useDarkMode;
        await window.store.set('settings', pref);
        setTheme(pref.useDarkMode);
    })
    
    $("nav a").each((_, elem) => {
        $(elem).on("click", function () {
            if (currentPage !== this.getAttribute("href")) {
                $("nav a").removeClass('active');
                unloadPage();
                currentPage = this.getAttribute("href");
                loadPage();
                $(this).addClass('active');
            }
        })
    })
    
    loadPage();
})

function loadPage() {
    switch(currentPage) {
        case "#item": loadItemPage(); break;
        case "#preferences": loadPrefPage(); break;
    }
}

function unloadPage() {
    switch(currentPage) {
        case "#item": unloadItemPage(); break;
    }
}

function setTheme(darkMode: boolean) {
    $("body").attr('data-bs-theme', darkMode ? "dark" : "light");
    $("#toggleThemeBtn").empty().append(darkMode ? "<i class='fa-solid fa-sun'>" : "<i class='fa solid fa-moon'>");
    const toolTip = bootstrap.Tooltip.getInstance($("#toggleThemeBtn")[0]);
    toolTip.hide();
    toolTip.setContent({
        '.tooltip-inner': darkMode ? 'Toggle Light Theme' : 'Toggle Dark Theme'
    });
}