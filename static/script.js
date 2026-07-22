// ==========================================
// Medical Concept Annotation Toolkit
// Part 1
// Global Variables + Extraction
// ==========================================


// ==========================================
// GLOBAL VARIABLES
// ==========================================

const editor = document.getElementById("inputText");

const extractBtn = document.getElementById("extractBtn");

const resultBox = document.getElementById("result");

const statisticsBox = document.getElementById("statistics");

let extractedEntities = [];

let originalText = "";

let currentPMID = "";

// Tracks whether the current extraction's text has been
// written to the "documents" table yet. Reset to false
// every time a new extraction happens.
let documentSaved = false;

const searchEntityBtn = document.getElementById("searchEntityBtn");

const modalPreferred = document.getElementById("modalPreferred");

const modalConfidence = document.getElementById("modalConfidence");

const modalSynonyms = document.getElementById("modalSynonyms");

const searchStatus = document.getElementById("searchStatus");

// ==========================================
// HIGHLIGHT CLASS
// ==========================================

function getHighlightClass(type){

    if(!type)
        return "unknown";

    if(type.includes("T047"))
        return "disease";

    if(type.includes("T121"))
        return "drug";

    if(type.includes("T184") || type.includes("T033"))
        return "symptom";

    if(type.includes("T060"))
        return "procedure";

    return "unknown";

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(str){

    if(!str)
        return "";

    return str
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;");

}


// ==========================================
// BUILD HIGHLIGHTED HTML
// ==========================================

function buildHighlightedHTML(text, entities){

    let html="";

    let currentIndex=0;

    const showAll=document.getElementById("allFilter").checked;

    const showDisease=document.getElementById("diseaseFilter").checked;

    const showDrug=document.getElementById("drugFilter").checked;

    const showSymptom=document.getElementById("symptomFilter").checked;

    entities.sort((a,b)=>a.start-b.start);

    entities.forEach(entity=>{

        if(entity.start==null || entity.end==null)
            return;

        if(entity.start<currentIndex)
            return;

        html += escapeHTML(
            text.substring(currentIndex,entity.start)
        );

        const cssClass=getHighlightClass(entity.type);

        let highlight=false;

        if(showAll){

            highlight=true;

        }

        else{

            if(cssClass==="disease" && showDisease)
                highlight=true;

            if(cssClass==="drug" && showDrug)
                highlight=true;

            if(cssClass==="symptom" && showSymptom)
                highlight=true;

        }

        const entityText=escapeHTML(

            text.substring(entity.start,entity.end)

        );

        if(highlight){

            html += `<span class="entity ${cssClass}" data-cui="${entity.cui}" data-type="${entity.type}" data-confidence="${entity.confidence}" data-start="${entity.start}" data-end="${entity.end}">${entityText}</span>`;

        }

        else{

            html += entityText;

        }

        currentIndex=entity.end;

    });

    html += escapeHTML(

        text.substring(currentIndex)

    );

    html = html.replace(/\n/g,"<br>");

    return html;

}



// ==========================================
// EXTRACT MEDICAL CONCEPTS
// ==========================================

extractBtn.addEventListener("click",async function(){

    originalText=editor.innerText.trim();

    if(originalText===""){

        alert("Please enter clinical text.");

        return;

    }

    extractBtn.disabled=true;

    extractBtn.innerHTML="Extracting...";

    try{

        const response=await fetch("/extract",{

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                text:originalText

            })

        });

        if(!response.ok){

            throw new Error("Extraction Failed");

        }

        const data=await response.json();

        console.log(data);

        currentPMID=data.pmid;

        documentSaved=false;

        extractedEntities=data.entities;

        editor.innerHTML=buildHighlightedHTML(

            originalText,

            extractedEntities

        );

        buildEntityTable(extractedEntities);

        updateStatistics(extractedEntities);

    }

    catch(error){

        console.error(error);

        alert("Extraction Failed");

    }

    finally{

        extractBtn.disabled=false;

        extractBtn.innerHTML="🔍 Extract Medical Concepts";

    }

});



// ==========================================
// ENTITY TABLE
// ==========================================

function buildEntityTable(entities){

    if(entities.length===0){

        resultBox.innerHTML="<h3>No Medical Concepts Found</h3>";

        return;

    }

    let html=`

<table class="resultTable">

<thead>

<tr>

<th>Entity</th>

<th>CUI</th>

<th>Type</th>

<th>Confidence</th>

<th>Start</th>

<th>End</th>

</tr>

</thead>

<tbody>

`;

    entities.forEach(entity=>{

        html += `

<tr>

<td>${entity.text}</td>

<td>${entity.cui}</td>

<td>${entity.type}</td>

<td>${Number(entity.confidence).toFixed(3)}</td>

<td>${entity.start}</td>

<td>${entity.end}</td>

</tr>

`;

    });

    html += "</tbody></table>";

    resultBox.innerHTML=html;

}



// ==========================================
// STATISTICS
// ==========================================

function updateStatistics(entities){

    let disease=0;

    let drug=0;

    let symptom=0;

    let procedure=0;

    let unknown=0;

    entities.forEach(entity=>{

        const cls=getHighlightClass(entity.type);

        if(cls==="disease")
            disease++;

        else if(cls==="drug")
            drug++;

        else if(cls==="symptom")
            symptom++;

        else if(cls==="procedure")
            procedure++;

        else
            unknown++;

    });

    statisticsBox.innerHTML=`

<div class="statCard">

<h3>${entities.length}</h3>

<p>Total</p>

</div>

<div class="statCard">

<h3>${disease}</h3>

<p>Disease</p>

</div>

<div class="statCard">

<h3>${drug}</h3>

<p>Drug</p>

</div>

<div class="statCard">

<h3>${symptom}</h3>

<p>Symptom</p>

</div>

<div class="statCard">

<h3>${procedure}</h3>

<p>Procedure</p>

</div>

<div class="statCard">

<h3>${unknown}</h3>

<p>Unknown</p>

</div>

`;

}



// ==========================================
// FILTER EVENTS
// ==========================================

document.querySelectorAll(

"#allFilter,#diseaseFilter,#drugFilter,#symptomFilter"

).forEach(box=>{

    box.addEventListener("change",function(){

        if(originalText==="")
            return;

        editor.innerHTML=buildHighlightedHTML(

            originalText,

            extractedEntities

        );

    });

});



// ==========================================
// ALL CHECKBOX
// ==========================================

document.getElementById("allFilter")

.addEventListener("change",function(){

    document.getElementById("diseaseFilter").checked=this.checked;

    document.getElementById("drugFilter").checked=this.checked;

    document.getElementById("symptomFilter").checked=this.checked;

});
// ==========================================
// PART 2
// TOOLTIP + SEARCH + EXPORT
// ==========================================


// ==========================================
// TOOLTIP
// ==========================================

const tooltip = document.getElementById("tooltip");

document.addEventListener("mouseover", function (event) {

    const target = event.target;

    if (!target.classList.contains("entity"))
        return;

    const cui = target.dataset.cui || "N/A";
    const type = target.dataset.type || "N/A";
    const confidence = target.dataset.confidence || "N/A";

    tooltip.innerHTML = `

<div class="tooltip-content">

<h3>Medical Entity</h3>

<p><strong>CUI :</strong> ${cui}</p>

<p><strong>Type :</strong> ${type}</p>

<p><strong>Confidence :</strong> ${Number(confidence).toFixed(3)}</p>

<button id="copyCuiBtn">

📋 Copy CUI

</button>

</div>

`;

    tooltip.style.display = "block";

    const rect = target.getBoundingClientRect();

    let left = rect.right + window.scrollX + 15;

    let top = rect.top + window.scrollY;

    if (left + 260 > window.innerWidth) {

        left = rect.left - 270;

    }

    tooltip.style.left = left + "px";

    tooltip.style.top = top + "px";

    document.getElementById("copyCuiBtn").onclick = async function () {

        await navigator.clipboard.writeText(cui);

        this.innerHTML = "✅ Copied";

        setTimeout(() => {

            this.innerHTML = "📋 Copy CUI";

        },1500);

    };

});



document.addEventListener("mouseout",function(event){

    if(!event.target.classList.contains("entity"))
        return;

    setTimeout(()=>{

        if(!tooltip.matches(":hover")){

            tooltip.style.display="none";

        }

    },150);

});


tooltip.addEventListener("mouseenter",function(){

    tooltip.style.display="block";

});


tooltip.addEventListener("mouseleave",function(){

    tooltip.style.display="none";

});



// ==========================================
// SEARCH DATABASE
// ==========================================

const searchInput=document.getElementById("searchInput");

const searchBtn=document.getElementById("searchBtn");

const searchResult=document.getElementById("searchResult");



searchInput.addEventListener("keypress",function(event){

    if(event.key==="Enter"){

        event.preventDefault();

        searchBtn.click();

    }

});



searchBtn.addEventListener("click",async function(){

    const query=searchInput.value.trim();

    if(query===""){

        alert("Enter a search keyword.");

        return;

    }

    searchBtn.disabled=true;

    searchBtn.innerHTML="Searching...";

    searchResult.innerHTML="<h3>Searching Database...</h3>";

    try{

        const response=await fetch("/search",{

            method:"POST",

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify({

                query:query

            })

        });

        const data=await response.json();

        if(data.results.length===0){

            searchResult.innerHTML="<h3>No Results Found</h3>";

        }

        else{

            let html="";

            data.results.forEach(item=>{

                html+=`

<div class="searchCard">

<h3>${item["Preferred Name"]}</h3>

<p><strong>CUI :</strong> ${item["CUI"]}</p>

<p><strong>Semantic Type :</strong> ${item["Type IDs"]}</p>

<p><strong>Synonyms :</strong> ${item["All Names / Synonyms"]}</p>

<p><strong>Confidence :</strong> ${item["Average Confidence"]}</p>

</div>

`;

            });

            searchResult.innerHTML=html;

        }

    }

    catch(error){

        console.error(error);

        searchResult.innerHTML="<h3>Search Failed</h3>";

    }

    finally{

        searchBtn.disabled=false;

        searchBtn.innerHTML="Search Database";

    }

});



// ==========================================
// EXPORT CSV
// ==========================================

const exportBtn=document.getElementById("exportBtn");



exportBtn.addEventListener("click",function(){

    if(extractedEntities.length===0){

        alert("Nothing to export.");

        return;

    }

    let csv="Entity,CUI,Type,Confidence,Start,End\n";

    extractedEntities.forEach(entity=>{

        csv+=

`${entity.text},

${entity.cui},

${entity.type},

${entity.confidence},

${entity.start},

${entity.end}\n`;

    });

    const blob=new Blob(

        [csv],

        {

            type:"text/csv"

        }

    );

    const url=URL.createObjectURL(blob);

    const a=document.createElement("a");

    a.href=url;

    a.download="medical_entities.csv";

    a.click();

    URL.revokeObjectURL(url);

});



// ==========================================
// HELPER
// ==========================================

function showMessage(message,color="green"){

    const status=document.getElementById("saveStatus");

    if(!status)
        return;

    status.innerHTML=message;

    status.style.color=color;

    setTimeout(()=>{

        status.innerHTML="";

    },3000);

}
// ==========================================
// PART 3
// MANUAL TAGGING + SAVE TO SQL
// ==========================================


// ==========================================
// ELEMENTS
// ==========================================
// ======================================
// CREATE BUTTON
// ======================================

const createTagBtn = document.getElementById("createTagBtn");

// ======================================
// CREATE POPUP FIELDS
// ======================================

const modalPMID = document.getElementById("modalPMID");

const modalEntity = document.getElementById("modalEntity");

const modalStart = document.getElementById("modalStart");

const modalEnd = document.getElementById("modalEnd");

const modalSemantic = document.getElementById("modalSemantic");

const modalCUI = document.getElementById("modalCUI");

// ======================================
// POPUP BUTTONS
// ======================================

const saveEntityBtn = document.getElementById("saveEntityBtn");

const closeModalBtn = document.getElementById("closeModalBtn");

// ======================================
// PENDING ENTITIES (STAGED, NOT SAVED YET)
// ======================================

let pendingTags = [];

const pendingListBox = document.getElementById("pendingList");

const saveAllBtn = document.getElementById("saveAllBtn");

const saveAllStatus = document.getElementById("saveAllStatus");


// ==========================================
// CREATE TAG
// ==========================================

searchEntityBtn.addEventListener(

    "click",

    searchCDB

);


// ==========================================
// CAPTURE SELECTED ENTITY
// ==========================================

function captureSelection(){

    openCreateModal();

}


// ==========================================
// ADD ENTITY TO PENDING LIST
// (No server call here — just stages it locally)
// ==========================================

saveEntityBtn.addEventListener("click", function(){

    if(modalEntity.value===""){

        alert("Capture an entity first.");

        return;

    }

    if(modalSemantic.value===""){

        alert("Enter Semantic Type.");

        return;

    }

    if(modalCUI.value===""){

        alert("Enter CUI.");

        return;

    }

    pendingTags.push({

        pmid:modalPMID.value,

        start:Number(modalStart.value),

        end:Number(modalEnd.value),

        entity:modalEntity.value,

        semantic_type:modalSemantic.value,

        cui:modalCUI.value

    });

    renderPendingList();

    clearTagForm();

});


// ==========================================
// RENDER PENDING LIST
// ==========================================

function renderPendingList(){

    if(pendingTags.length===0){

        pendingListBox.innerHTML="No entities selected yet.";

        return;

    }

    let html=`

        <table class="pendingTable">

            <thead>

                <tr>

                    <th>Entity</th>

                    <th>Semantic Type</th>

                    <th>CUI</th>

                    <th>Start</th>

                    <th>End</th>

                    <th></th>

                </tr>

            </thead>

            <tbody>

    `;

    pendingTags.forEach(function(tag, index){

        html+=`

            <tr>

                <td>${tag.entity}</td>

                <td>${tag.semantic_type}</td>

                <td>${tag.cui}</td>

                <td>${tag.start}</td>

                <td>${tag.end}</td>

                <td>

                    <button

                        class="removeTagBtn"

                        data-index="${index}"

                    >

                        ✖ Remove

                    </button>

                </td>

            </tr>

        `;

    });

    html+=`

            </tbody>

        </table>

    `;

    pendingListBox.innerHTML=html;

}


// ==========================================
// REMOVE A PENDING ENTITY (event delegation)
// ==========================================

pendingListBox.addEventListener("click", function(e){

    if(!e.target.classList.contains("removeTagBtn"))
        return;

    const index=Number(e.target.dataset.index);

    pendingTags.splice(index,1);

    renderPendingList();

});


// ==========================================
// SAVE ALL PENDING ENTITIES (bulk save)
// ==========================================

saveAllBtn.addEventListener("click", async function(){

    if(pendingTags.length===0){

        alert("No entities to save. Add some first.");

        return;

    }

    saveAllBtn.disabled=true;

    saveAllBtn.innerHTML="Saving...";

    try{

        const response=await fetch("/save_entities_bulk",{

            method:"POST",

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify({tags:pendingTags})

        });

        const data=await response.json();

        if(response.ok){

            saveAllStatus.style.color="green";

            saveAllStatus.innerHTML=data.message || "✅ All entities saved successfully";

            pendingTags=[];

            renderPendingList();

        }

        else{

            saveAllStatus.style.color="red";

            saveAllStatus.innerHTML=data.error || "Save Failed";

        }

    }

    catch(error){

        console.error(error);

        saveAllStatus.style.color="red";

        saveAllStatus.innerHTML="Server Error";

    }

    finally{

        saveAllBtn.disabled=false;

        saveAllBtn.innerHTML="💾 Save All Entities";

    }

});


// ==========================================
// CLEAR TAG FORM
// ==========================================

function clearTagForm(){

    modalPMID.value="";

    modalEntity.value="";

    modalStart.value="";

    modalEnd.value="";

    modalSemantic.value="";

    modalCUI.value="";

    modalPreferred.value="";

    modalConfidence.value="";

    modalSynonyms.value="";

    createModal.style.display="none";

}


// ==========================================
// DOUBLE CLICK TO CAPTURE
// ==========================================

editor.addEventListener("dblclick",function(){

    captureSelection();

});


// ==========================================
// KEYBOARD SHORTCUT
// Ctrl + Shift + S
// ==========================================

document.addEventListener("keydown",function(e){

    if(e.ctrlKey && e.shiftKey && e.key==="S"){

        e.preventDefault();

        saveEntityBtn.click();

    }

});


// ==========================================
// CLICK ENTITY TO PREFILL FORM
// ==========================================

document.addEventListener("click",async function(e){

    if(!e.target.classList.contains("entity"))
        return;

    const saved = await ensureDocumentSaved();

    if(!saved){

        return;

    }

    modalPMID.value=currentPMID;

    modalEntity.value=e.target.innerText;

    modalStart.value=e.target.dataset.start || "";

    modalEnd.value=e.target.dataset.end || "";

    modalSemantic.value=e.target.dataset.type || "";

    modalCUI.value=e.target.dataset.cui || "";

    createModal.style.display="block";

});


// ==========================================
// RESET EVERYTHING
// ==========================================

function resetApplication(){

    extractedEntities=[];

    originalText="";

    currentPMID="";

    documentSaved=false;

    resultBox.innerHTML="No entities extracted yet.";

    statisticsBox.innerHTML="";

    clearTagForm();

}
const createModal = document.getElementById("createModal");

const createBtn = document.getElementById("createTagBtn");

// ==========================================
// SAVE DOCUMENT (only once per extraction,
// triggered the first time "Create" is used)
// ==========================================

async function ensureDocumentSaved(){

    if(documentSaved){

        return true;

    }

    if(currentPMID===""){

        alert("Please extract text first.");

        return false;

    }

    try{

        const response = await fetch("/save_document",{

            method:"POST",

            headers:{

                "Content-Type":"application/json"

            },

            body:JSON.stringify({

                pmid:currentPMID,

                text:originalText

            })

        });

        const data = await response.json();

        if(!response.ok){

            alert(data.error || "Failed to save document.");

            return false;

        }

        documentSaved=true;

        return true;

    }

    catch(error){

        console.error(error);

        alert("Server error while saving document.");

        return false;

    }

}

async function openCreateModal(){

    const selection = window.getSelection();

    const selectedText = selection.toString().trim();

    if(selectedText===""){

        alert("Select an unhighlighted entity first.");

        return;

    }

    const saved = await ensureDocumentSaved();

    if(!saved){

        return;

    }

    const fullText = editor.innerText;

    const start = fullText.indexOf(selectedText);

    const end = start + selectedText.length;

    document.getElementById("modalPMID").value=currentPMID;

    document.getElementById("modalEntity").value=selectedText;

    document.getElementById("modalStart").value=start;

    document.getElementById("modalEnd").value=end;

    document.getElementById("modalSemantic").value="";

    document.getElementById("modalCUI").value="";

    createModal.style.display="block";

}

createBtn.addEventListener("click", openCreateModal);

closeModalBtn.addEventListener("click", function(){

    createModal.style.display="none";

});


// ==========================================
// END OF FILE
// ==========================================

// =========================================
// SEARCH ENTITY IN CDB
// =========================================

async function searchCDB() {

    const entity = document
        .getElementById("modalEntity")
        .value
        .trim();

    if (entity === "") {

        alert("No entity selected.");

        return;
    }

    searchStatus.innerHTML = "Searching CDB...";

    try {

        const response = await fetch("/search_cdb", {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                entity: entity

            })

        });

        const data = await response.json();

        if (data.found) {

            modalPreferred.value = data.preferred;

            modalSemantic.value = data.semantic;

            modalCUI.value = data.cui;

            modalConfidence.value = data.confidence;

            modalSynonyms.value = data.synonyms;

            searchStatus.innerHTML =
                "✅ Entity found in CDB";

        }

        else {

            modalPreferred.value = "";

            modalConfidence.value = "";

            modalSynonyms.value = "";

            modalSemantic.value = "";

            modalCUI.value = "";

            searchStatus.innerHTML =
                "❌ Entity not found in CDB";

        }

    }

    catch (error) {

        console.log(error);

        searchStatus.innerHTML =
            "Server Error";

    }

}