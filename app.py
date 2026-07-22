from flask import Flask, render_template, request, jsonify
from medcat.cat import CAT
import pandas as pd
import time
from database.db import get_connection

app = Flask(__name__)

# ==========================================
# LOAD MEDCAT MODEL
# ==========================================

MODEL_PATH = r"C:\Users\priya\Downloads\medmen_wstatus_2021_oct.zip"

print("Loading MedCAT Model...")
cat = CAT.load_model_pack(MODEL_PATH)
print("MedCAT Loaded Successfully")

# ==========================================
# LOAD EXCEL DATABASE
# ==========================================

print("Loading Excel Database...")

df = pd.read_excel(
    "cdb_complete.xlsx",
    engine="openpyxl"
)

df = df.fillna("")

print("Excel Loaded Successfully")

# ==========================================
# HOME PAGE
# ==========================================

@app.route("/")
def home():
    return render_template("index.html")


# ==========================================
# EXTRACT MEDICAL ENTITIES
# ==========================================

@app.route("/extract", methods=["POST"])
def extract():

    try:

        data = request.get_json()

        text = data.get("text", "")

        pmid = int(time.time())

        # NOTE: document is no longer saved here.
        # It only gets inserted into the "documents" table
        # when the user clicks "Create" (see /save_document below).

        result = cat.get_entities(text)

        entities=[]

        for entity in result["entities"].values():

            entities.append({

                "text":entity.get("source_value",""),

                "cui":entity.get("cui",""),

                "type":entity.get("type_ids",""),

                "detected_name":entity.get("detected_name",""),

                "start":entity.get("start",0),

                "end":entity.get("end",0),

                "confidence":entity.get("context_similarity",0)

            })

        return jsonify({

            "pmid":pmid,

            "input":text,

            "entities":entities

        })

    except Exception as e:

        return jsonify({

            "error":str(e)

        }),500


# ==========================================
# SEARCH EXCEL DATABASE
# ==========================================

@app.route("/search", methods=["POST"])
def search():

    try:

        data=request.get_json()

        query=data.get("query","").strip().lower()

        if query=="":

            return jsonify({

                "results":[]

            })

        results=[]

        for _,row in df.iterrows():

            row_text=" ".join([

                str(row["CUI"]).lower(),

                str(row["Preferred Name"]).lower(),

                str(row["All Names / Synonyms"]).lower(),

                str(row["Type IDs"]).lower(),

                str(row["Average Confidence"]).lower(),

                str(row["Info"]).lower(),

                str(row["Tags"]).lower()

            ])

            if query in row_text:

                results.append({

                    "CUI":str(row["CUI"]),

                    "Preferred Name":str(row["Preferred Name"]),

                    "All Names / Synonyms":str(row["All Names / Synonyms"]),

                    "Type IDs":str(row["Type IDs"]),

                    "Train Count":str(row["Train Count"]),

                    "Average Confidence":str(row["Average Confidence"]),

                    "Info":str(row["Info"]),

                    "Tags":str(row["Tags"])

                })

        return jsonify({

            "results":results

        })

    except Exception as e:

        return jsonify({

            "error":str(e)

        }),500
    



# ==========================================
# SEARCH CDB FOR CREATE POPUP
# ==========================================

@app.route("/search_cdb", methods=["POST"])
def search_cdb():

    try:

        data = request.get_json()

        entity = data.get("entity", "").strip().lower()

        if entity == "":
            return jsonify({
                "found": False
            })

        result = search_cdb_tree(entity)

        if result:

            return jsonify(result)

        return jsonify({

            "found": False

        })

    except Exception as e:

        return jsonify({

            "error": str(e)

        }),500


# ==========================================
# NORMALIZER TREE FOR CDB SEARCH
#
# Level 1 : check the word exactly as typed
# Level 2 : if no match, strip a trailing "s"
#           (naive singularization) and check again
#           e.g. "vitals" -> "vital"
#
# Add further levels here later if needed
# (e.g. stripping "es", "ing", etc.)
# ==========================================

def find_match_in_df(word):
    """
    Looks for a single normalized word form in the CDB dataframe.
    Returns a result dict if found, otherwise None.
    """

    for _, row in df.iterrows():

        preferred = str(row["Preferred Name"]).lower()

        synonyms = str(row["All Names / Synonyms"]).lower()

        info = str(row["Info"]).lower()

        tags = str(row["Tags"]).lower()

        if (
            word == preferred or
            word in preferred or
            word in synonyms or
            word in info or
            word in tags
        ):

            return {

                "found": True,

                "preferred": row["Preferred Name"],

                "cui": row["CUI"],

                "semantic": row["Type IDs"],

                "confidence": row["Average Confidence"],

                "synonyms": row["All Names / Synonyms"],

                "matched_as": word

            }

    return None


def search_cdb_tree(word):
    """
    Tries progressively normalized forms of `word` against the CDB,
    stopping at the first level that finds a match.
    """

    # Level 1 : exact word, as typed
    result = find_match_in_df(word)

    if result:

        return result

    # Level 2 : strip a trailing "s" and try again
    if word.endswith("s") and len(word) > 2:

        singular = word[:-1]

        result = find_match_in_df(singular)

        if result:

            return result

    return None


    

# ==========================================
# SAVE MANUAL TAG
# ==========================================

@app.route("/add_tag", methods=["POST"])
def add_tag():

    try:

        data=request.get_json()

        conn=get_connection()

        cursor=conn.cursor()

        cursor.execute("""

        INSERT INTO entity_tags

        (PMID,StartPos,EndPos,Entity,SemanticType,CUI)

        VALUES(%s,%s,%s,%s,%s,%s)

        """,(

            data["pmid"],

            data["start"],

            data["end"],

            data["entity"],

            data["semantic_type"],

            data["cui"]

        ))

        conn.commit()

        cursor.close()

        conn.close()

        return jsonify({

            "status":"success"

        })

    except Exception as e:

        return jsonify({

            "error":str(e)

        }),500


# ==========================================
# SAVE DOCUMENT
# (Runs only when the user clicks "Create" for
# the first time on a given extraction, NOT on
# every Extract click)
# ==========================================

@app.route("/save_document", methods=["POST"])
def save_document():

    try:

        data = request.get_json()

        pmid = data.get("pmid")

        text = data.get("text", "")

        if not pmid or text.strip() == "":

            return jsonify({

                "error": "Missing pmid or text"

            }), 400

        conn = get_connection()

        cursor = conn.cursor()

        # Avoid inserting the same document twice
        # (e.g. if Create is clicked more than once
        # for the same extraction, or on a rapid
        # double-click before the frontend flag is set)
        cursor.execute("""

        SELECT PMID FROM documents WHERE PMID=%s

        """,(pmid,))

        existing = cursor.fetchone()

        if existing:

            cursor.close()

            conn.close()

            return jsonify({

                "message": "Document already saved",

                "pmid": pmid

            })

        cursor.execute("""

        INSERT INTO documents(PMID,sentence)

        VALUES(%s,%s)

        """,(pmid,text))

        conn.commit()

        cursor.close()

        conn.close()

        return jsonify({

            "message": "Document saved successfully",

            "pmid": pmid

        })

    except Exception as e:

        return jsonify({

            "error": str(e)

        }),500


# ==========================================
# SAVE ENTITY
# ==========================================

@app.route("/save_entity", methods=["POST"])
def save_entity():

    try:

        data=request.get_json()

        conn=get_connection()

        cursor=conn.cursor()

        cursor.execute("""

        INSERT INTO entity_tags

        (PMID,StartPos,EndPos,Entity,SemanticType,CUI)

        VALUES(%s,%s,%s,%s,%s,%s)

        """,(

            data["pmid"],

            data["start"],

            data["end"],

            data["entity"],

            data["semantic_type"],

            data["cui"]

        ))

        conn.commit()

        cursor.close()

        conn.close()

        return jsonify({

            "message":"Entity Saved Successfully"

        })

    except Exception as e:

        return jsonify({

            "error":str(e)

        }),500


# ==========================================
# SAVE ALL PENDING ENTITIES (BULK)
# ==========================================

@app.route("/save_entities_bulk", methods=["POST"])
def save_entities_bulk():

    try:

        data = request.get_json()

        tags = data.get("tags", [])

        if not tags:

            return jsonify({

                "error": "No entities to save"

            }), 400

        conn = get_connection()

        cursor = conn.cursor()

        values = [

            (

                tag["pmid"],

                tag["start"],

                tag["end"],

                tag["entity"],

                tag["semantic_type"],

                tag["cui"]

            )

            for tag in tags

        ]

        cursor.executemany("""

        INSERT INTO entity_tags

        (PMID,StartPos,EndPos,Entity,SemanticType,CUI)

        VALUES(%s,%s,%s,%s,%s,%s)

        """, values)

        conn.commit()

        cursor.close()

        conn.close()

        return jsonify({

            "message": f"{len(values)} entities saved successfully"

        })

    except Exception as e:

        return jsonify({

            "error": str(e)

        }),500


# ==========================================
# RUN APP
# ==========================================

if __name__=="__main__":

    app.run(debug=True)