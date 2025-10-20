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

            // Helper function to convert plain text to HTML while preserving line breaks
            const plainTextToHtml = ( plainText ) => {
              const lines = plainText.split( /\r?\n/ );
              return lines.map( line => line.trim() === '' ? '<p>&nbsp;</p>' : `<p>${line}</p>` ).join( '' );
            };

            // Override clipboard to force plain text pasting
            editor.editing.view.document.on( 'clipboardInput', ( evt, data ) => {
              const plainText = data.dataTransfer.getData( 'text/plain' );
              
              if ( plainText ) {
                // Convert plain text to HTML
                const htmlContent = plainTextToHtml( plainText );
                
                // Create view fragment from HTML
                const viewFragment = editor.data.processor.toView( htmlContent );
                const modelFragment = editor.data.toModel( viewFragment );
                
                // Insert the content
                editor.model.change( writer => {
                  editor.model.insertContent( modelFragment );
                } );

                // Prevent default paste behavior
                evt.stop();
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
