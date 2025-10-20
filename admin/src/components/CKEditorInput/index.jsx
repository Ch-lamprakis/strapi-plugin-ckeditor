import React, { useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Flex } from '@strapi/design-system';
import { Field } from '@strapi/design-system';
import PropTypes from "prop-types";

import { getGlobalStyling } from './GlobalStyling';
import Configurator from './Configurator';
import MediaLib from '../MediaLib';

import { CKEditor } from '@ckeditor/ckeditor5-react';

const { ClassicEditor } = window.CKEDITOR;

import sanitize from './utils/utils';
import { useField } from '@strapi/strapi/admin';

const strapiTheme = localStorage.getItem( 'STRAPI_THEME' ) || 'light';
const GlobalStyling = getGlobalStyling( strapiTheme );

const CKEditorInput = ( props ) => {
  const {
    attribute,
    name,
    disabled,
    labelAction,
    required,
    description,
    error,
    intlLabel } = props;
  const { onChange, value } = useField( name );
  const [ editorInstance, setEditorInstance ] = useState(false);
  const { formatMessage } = useIntl();
  const { maxLengthCharacters:maxLength , ...options } = attribute.options;
  const configurator = new Configurator( { options, maxLength } );
  const editorConfig = configurator.getEditorConfig();

  const wordCounter = useRef( null );

  const [ mediaLibVisible, setMediaLibVisible ] = useState( false );

  const handleToggleMediaLib = () => setMediaLibVisible( prev => !prev );

  const handleChangeAssets = assets => {
    let imageHtmlString = '';

    assets.map( asset => {
      if ( asset.mime.includes('image') ) {
        const url = sanitize( asset.url );
        const alt = sanitize( asset.alt );

        imageHtmlString += `<img src="${ url }" alt="${ alt }" />`;
      }
    } );

    const viewFragment = editorInstance.data.processor.toView( imageHtmlString );
    const modelFragment = editorInstance.data.toModel( viewFragment );
    editorInstance.model.insertContent( modelFragment );

    handleToggleMediaLib();
  };

  return (
    <Field.Root
      name= {name }
      id={ name }
      // GenericInput calls formatMessage and returns a string for the error
      error={ error }
      hint={ description && formatMessage( description ) }
    >
      <Flex spacing={ 1 } alignItems="normal" style={ { 'flexDirection': 'column' } }>
        <Field.Label action={ labelAction } required={ required }>
          { intlLabel ? formatMessage( intlLabel ) : name }
        </Field.Label>
        <GlobalStyling />
        <CKEditor
          editor={ ClassicEditor }
          disabled={ disabled }
          data={ value ?? '' }
          onReady={ ( editor ) => {
            const wordCountPlugin = editor.plugins.get( 'WordCount' );
            const wordCountWrapper = wordCounter.current;
            wordCountWrapper.appendChild( wordCountPlugin.wordCountContainer );

            const mediaLibPlugin = editor.plugins.get( 'strapiMediaLib' );
            mediaLibPlugin.connect( handleToggleMediaLib );

            // Force plain text pasting behavior - overrides all formatting from clipboard
            // This implementation intercepts paste operations and ensures only plain text is processed
            
            // First, intercept at the clipboard input level to strip all formatting
            editor.plugins.get( 'ClipboardPipeline' ).on( 'clipboardInput', ( evt, data ) => {
              const plainText = data.dataTransfer.getData( 'text/plain' );
              if ( plainText ) {
                console.log( 'CKEditor: Forcing plain text paste, stripping formatting from:', plainText.substring( 0, 100 ) + '...' );
                
                // Clear all formatted data (HTML, RTF, etc.) and keep only plain text
                data.dataTransfer.clearData();
                data.dataTransfer.setData( 'text/plain', plainText );
                
                // Remove any HTML content that might bypass plain text detection
                data.dataTransfer.setData( 'text/html', '' );
              }
            }, { priority: 'highest' } );
            
            // Second, process the input transformation to convert plain text to editor format
            editor.plugins.get( 'ClipboardPipeline' ).on( 'inputTransformation', ( evt, data ) => {
              const plainText = data.dataTransfer.getData( 'text/plain' );
              
              if ( plainText ) {
                // Stop the default processing to prevent any formatting
                evt.stop();
                
                // Process plain text: preserve line breaks, escape HTML entities
                const lines = plainText.split( /\r?\n/ );
                let htmlContent = '';
                
                lines.forEach( ( line, index ) => {
                  // Add line breaks between lines (except for the first line)
                  if ( index > 0 ) {
                    htmlContent += '<br>';
                  }
                  
                  // Escape HTML entities to prevent any HTML injection
                  const escapedLine = line
                    .replace( /&/g, '&amp;' )
                    .replace( /</g, '&lt;' )
                    .replace( />/g, '&gt;' )
                    .replace( /"/g, '&quot;' )
                    .replace( /'/g, '&#39;' );
                  
                  htmlContent += escapedLine;
                } );
                
                // Wrap in paragraph if empty or set the processed content
                const finalContent = htmlContent.trim() || '&nbsp;';
                const wrappedContent = finalContent.includes( '<br>' ) ? finalContent : `<p>${finalContent}</p>`;
                
                // Convert to editor's view format
                data.content = editor.data.htmlProcessor.toView( wrappedContent );
              }
            }, { priority: 'high' } );

            setEditorInstance( editor );
          }}
          onChange={ ( event, editor ) => {
            const data = editor.getData();
            onChange( { target: { name, value: data } } );

            const wordCountPlugin = editor.plugins.get( 'WordCount' );
            const numberOfCharacters = wordCountPlugin.characters;

            if ( numberOfCharacters > maxLength ) {
              console.log( 'Too long' );
            }
          }}
          config={ editorConfig }
        />
        <div ref={ wordCounter }></div>
        <Field.Hint />
        <Field.Error />
      </Flex>
      <MediaLib isOpen={ mediaLibVisible } onChange={ handleChangeAssets } onToggle={ handleToggleMediaLib } />
    </Field.Root>
  );
};

CKEditorInput.propTypes = {
  attribute: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  description: PropTypes.object,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  labelAction: PropTypes.object,
  required: PropTypes.bool
};

export default CKEditorInput;
