'use strict';

module.exports = {
    xml2json: xml2json
};

//***********************************************************************
// Main function. Clears the given xml and then starts the recursion
//***********************************************************************
function xml2json(xmlStr){ 
    xmlStr = cleanXML(xmlStr);
    return xml2jsonRecurse(xmlStr,0); 
}

//***********************************************************************
// Recursive function that creates a JSON object with a given XML string.
//***********************************************************************
function xml2jsonRecurse(xmlStr) {
    var obj = {},
        tagName, indexClosingTag, inner_substring, tempVal, openingTag;

    while (xmlStr.match(/<[^\/][^>]*>/)) {
        openingTag = xmlStr.match(/<[^\/][^>]*>/)[0];
        tagName = openingTag.substring(1, openingTag.length - 1);
        indexClosingTag = xmlStr.indexOf(openingTag.replace('<', '</'));

        // account for case where additional information in the openning tag
        if (indexClosingTag == -1) {

            tagName = openingTag.match(/[^<][\w+$]*/)[0];
            indexClosingTag = xmlStr.indexOf('</' + tagName);
            if (indexClosingTag == -1) {
                indexClosingTag = xmlStr.indexOf('<\\/' + tagName);
            }
        }
        inner_substring = xmlStr.substring(openingTag.length, indexClosingTag);
        if (inner_substring.match(/<[^\/][^>]*>/)) {
            tempVal = xml2json(inner_substring);
        }
        else {
            tempVal = inner_substring;
        }
        // account for array or obj //
        if (obj[tagName] === undefined) {
            obj[tagName] = tempVal;
        }
        else if (Array.isArray(obj[tagName])) {
            obj[tagName].push(tempVal);
        }
        else {
            obj[tagName] = [obj[tagName], tempVal];
        }

        xmlStr = xmlStr.substring(openingTag.length * 2 + 1 + inner_substring.length);
    }

    return obj;
}

//*****************************************************************
// Removes some characters that would break the recursive function.
//*****************************************************************
function cleanXML(xmlStr) {
    
    xmlStr = xmlStr.replace( /<!--[\s\S]*?-->/g, '' ); //remove commented lines
    xmlStr = xmlStr.replace(/\n|\t|\r/g, ''); //replace special characters
    xmlStr = xmlStr.replace(/ {1,}<|\t{1,}</g, '<'); //replace leading spaces and tabs
    xmlStr = xmlStr.replace(/> {1,}|>\t{1,}/g, '>'); //replace trailing spaces and tabs
    xmlStr = xmlStr.replace(/<\?[^>]*\?>/g, ''); //delete docType tags

    xmlStr = replaceSelfClosingTags(xmlStr); //replace self closing tags
    xmlStr = replaceAloneValues(xmlStr); //replace the alone tags values
    xmlStr = replaceAttributes(xmlStr); //replace attributes

    return xmlStr;
}

//************************************************************************************************************
// Replaces all the self closing tags with attributes with another tag containing its attribute as a property.
// The function works if the tag contains multiple attributes. 
//
// Example : '<tagName attrName="attrValue" />' becomes 
//           '<tagName><attrName>attrValue</attrName></tagName>'
//************************************************************************************************************
function replaceSelfClosingTags(xmlStr) {

    var selfClosingTags = xmlStr.match(/<[^/][^>]*\/>/g);

    if (selfClosingTags) {
        for (var i = 0; i < selfClosingTags.length; i++) {

            var oldTag = selfClosingTags[i];
            var tempTag = oldTag.substring(0, oldTag.length - 2);
            tempTag += ">";

            var tagName = oldTag.match(/[^<][\w+$]*/)[0];
            var closingTag = "</" + tagName + ">";
            var newTag = "<" + tagName + ">";

            var attrs = tempTag.match(/(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/g);

            if (attrs) {
                for(var j = 0; j < attrs.length; j++) {
                    var attr = attrs[j];
                    var attrName = attr.substring(0, attr.indexOf('='));
                    var attrValue = attr.substring(attr.indexOf('"') + 1, attr.lastIndexOf('"'));
                    
                    newTag += "<" + attrName + ">" + attrValue + "</" + attrName + ">";
                }
            }

            newTag += closingTag;

            xmlStr = xmlStr.replace(oldTag, newTag);
        }
    }

    return xmlStr;
}

//*************************************************************************************************
// Replaces all the tags with attributes and a value with a new tag.
// 
// Example : '<tagName attrName="attrValue">tagValue</tagName>' becomes 
//           '<tagName><attrName>attrValue</attrName><_@attribute>tagValue</_@attribute></tagName>'
//*************************************************************************************************
function replaceAloneValues(xmlStr) {
 
    var tagsWithAttributesAndValue = xmlStr.match(/<[^\/][^>][^<]+\s+.[^<]+[=][^<]+>{1}([^<]+)/g);
    
    if (tagsWithAttributesAndValue) {
        for(var i = 0; i < tagsWithAttributesAndValue.length; i++) {

            var oldTag = tagsWithAttributesAndValue[i];
            var oldTagName = oldTag.substring(0, oldTag.indexOf(">") + 1);
            var oldTagValue = oldTag.substring(oldTag.indexOf(">") + 1);
            
            var newTag = oldTagName + "<_@ttribute>" + oldTagValue + "</_@ttribute>";
            
            xmlStr = xmlStr.replace(oldTag, newTag);
        }    
    }
    
    return xmlStr;
}

//*****************************************************************************************************************
// Replaces all the tags with attributes with another tag containing its attribute as a property.
// The function works if the tag contains multiple attributes.
//
// Example : '<tagName attrName="attrValue"></tagName>' becomes '<tagName><attrName>attrValue</attrName></tagName>'
//*****************************************************************************************************************
function replaceAttributes(xmlStr) {

    var tagsWithAttributes = xmlStr.match(/<[^\/][^>][^<]+\s+.[^<]+[=][^<]+>/g);

    if (tagsWithAttributes) {
        for (var i = 0; i < tagsWithAttributes.length; i++) {
           
            var oldTag = tagsWithAttributes[i];
            var tagName = oldTag.match(/[^<][\w+$]*/)[0];
            var newTag = "<" + tagName + ">";
            var attrs = oldTag.match(/(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/g);

            if (attrs) {
                for(var j = 0; j < attrs.length; j++) {
                    
                    var attr = attrs[j];
                    var attrName = attr.substring(0, attr.indexOf('='));
                    var attrValue = attr.substring(attr.indexOf('"') + 1, attr.lastIndexOf('"'));
                    
                    newTag += "<" + attrName + ">" + attrValue + "</" + attrName + ">";
                }
            }

            xmlStr = xmlStr.replace(oldTag, newTag);
        }
    }

    return xmlStr;
}
