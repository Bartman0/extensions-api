'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {
  $(document).ready(function () {
    tableau.extensions.initializeAsync().then(function () {
      // Since dataSource info is attached to the worksheet, we will perform
      // one async call per worksheet to get every dataSource used in this
      // dashboard.  This demonstrates the use of Promise.all to combine
      // promises together and wait for each of them to resolve.
      let dataSourceFetchPromises = [];

      // Maps dataSource id to dataSource so we can keep track of unique dataSources.
      let dashboardDataSources = {};

      // To get dataSource info, first get the dashboard.
      const dashboard = tableau.extensions.dashboardContent.dashboard;

      // Then loop through each worksheet and get its dataSources, save promise for later.
      dashboard.worksheets.forEach(function (worksheet) {
        dataSourceFetchPromises.push(worksheet.getDataSourcesAsync());
      });

      showChooseSheetDialog();
      // Fetch the saved sheet name from settings. This will be undefined if there isn't one configured yet
//      const savedSheetName = tableau.extensions.settings.get('sheet');
//      if (savedSheetName) {
//          // We have a saved sheet name, show its selected marks
//          loadSelectedMarks(savedSheetName);
//      } else {
//          // If there isn't a sheet saved in settings, show the dialog
//          showChooseSheetDialog();
//      }

      initializeButtons();

//      Promise.all(dataSourceFetchPromises).then(function (fetchResults) {
//        fetchResults.forEach(function (dataSourcesForWorksheet) {
//          dataSourcesForWorksheet.forEach(function (dataSource) {
//            if (!dashboardDataSources[dataSource.id]) { // We've already seen it, skip it.
//              dashboardDataSources[dataSource.id] = dataSource;
//            }
//          });
//        });

//        buildDataSourcesTable(dashboardDataSources);

//        // This just modifies the UI by removing the loading banner and showing the dataSources table.
//        $('#loading').addClass('hidden');
//        $('#dataSourcesTable').removeClass('hidden').addClass('show');
//      });
    }, function (err) {
      // Something went wrong in initialization.
      console.log('Error while Initializing: ' + err.toString());
    });
  });

  function initializeButtons() {
    $('#show_choose_sheet_button').click(showChooseSheetDialog);
  }

  function showChooseSheetDialog() {
    // Clear out the existing list of sheets
    $('#choose_sheet_buttons').empty();

    // Set the dashboard's name in the title
    const dashboardName = tableau.extensions.dashboardContent.dashboard.name;
    $('#choose_sheet_title').text(dashboardName);

    // The first step in choosing a sheet will be asking Tableau what sheets are available
    const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

    // Next, we loop through all of these worksheets and add buttons for each one
    worksheets.forEach(function(worksheet) {
      // Declare our new button which contains the sheet name
      const button = createButton(worksheet.name);

      // Create an event handler for when this button is clicked
      button.click(function() {
        // Get the worksheet name and save it to settings.
        const worksheetName = worksheet.name;
        tableau.extensions.settings.set('sheet', worksheetName);
        tableau.extensions.settings.saveAsync().then(function() {
            // Once the save has completed, close the dialog and show the data table for this worksheet
            $('#choose_sheet_dialog').modal('toggle');
            loadSelectedMarks(worksheetName);
        });
      });

      // Add our button to the list of worksheets to choose from
      $('#choose_sheet_buttons').append(button);
    });

    // Show the dialog
    $('#choose_sheet_dialog').modal('toggle');
  }

  function createButton(buttonTitle) {
    const button =
      $(`<button type='button' class='btn btn-default btn-block'>
      ${buttonTitle}
      </button>`);

    return button;
  }

  // Refreshes the given dataSource.
  function sendToTimifyDataSource (dataSource) {
    dataSource.refreshAsync().then(function () {
      console.log(dataSource.name + ': Refreshed Successfully');
    });
  }

  // Displays a modal dialog with more details about the given dataSource.
  function showModal(dataSource) {
    let modal = $('#infoModal');

    $('#nameDetail').text(dataSource.name);
    $('#idDetail').text(dataSource.id);
    $('#typeDetail').text((dataSource.isExtract) ? 'Extract' : 'Live');

    // Loop through every field in the dataSource and concat it to a string.
    let fieldNamesStr = '';
    dataSource.fields.forEach(function (field) {
      fieldNamesStr += field.name + ', ';
    });

    // Slice off the last ", " for formatting.
    $('#fieldsDetail').text(fieldNamesStr.slice(0, -2));

    dataSource.getConnectionSummariesAsync().then(function (connectionSummaries) {
      // Loop through each connection summary and list the connection's
      // name and type in the info field
      let connectionsStr = '';
      connectionSummaries.forEach(function (summary) {
        connectionsStr += summary.name + ': ' + summary.type + ', ';
      });

      // Slice of the last ", " for formatting.
      $('#connectionsDetail').text(connectionsStr.slice(0, -2));
    });

    dataSource.getActiveTablesAsync().then(function (activeTables) {
      // Loop through each table that was used in creating this datasource
      let tableStr = '';
      activeTables.forEach(function (table) {
        tableStr += table.name + ', ';
      });

      // Slice of the last ", " for formatting.
      $('#activeTablesDetail').text(tableStr.slice(0, -2));
    });

    modal.modal('show');
  }

  // Constructs UI that displays all the dataSources in this dashboard
  // given a mapping from dataSourceId to dataSource objects.
  function buildDataSourcesTable (dataSources) {
    // Clear the table first.
    $('#dataSourcesTable > tbody tr').remove();
    const dataSourcesTable = $('#dataSourcesTable > tbody')[0];

    // Add an entry to the dataSources table for each dataSource.
    for (let dataSourceId in dataSources) {
      const dataSource = dataSources[dataSourceId];

      let newRow = dataSourcesTable.insertRow(dataSourcesTable.rows.length);
      let nameCell = newRow.insertCell(0);
      let sendToTimifyCell = newRow.insertCell(1);
      let infoCell = newRow.insertCell(2);

      let sendToTimifyButton = document.createElement('button');
      sendToTimifyButton.innerHTML = ('Send to Timify');
      sendToTimifyButton.type = 'button';
      sendToTimifyButton.className = 'btn btn-primary';
      sendToTimifyButton.addEventListener('click', function () { sendToTimifyDataSource(dataSource); });

      let infoSpan = document.createElement('span');
      infoSpan.className = 'glyphicon glyphicon-info-sign';
      infoSpan.addEventListener('click', function () { showModal(dataSource); });

      nameCell.innerHTML = dataSource.name;
      sendToTimifyCell.appendChild(sendToTimifyButton);
      infoCell.appendChild(infoSpan);
    }
  }

  function eraseSetting (key, row) {
    // This change won't be persisted until settings.saveAsync has been called.
    tableau.extensions.settings.erase(key);

    // Remove the setting from the UI immediately.
    row.remove();

    // Save in the background, saveAsync results don't need to be handled immediately.
    tableau.extensions.settings.saveAsync();

    updateUIState(Object.keys(tableau.extensions.settings.getAll()).length > 0);
  }

  function buildSettingsTable (settings) {
    // Clear the table first.
    $('#settingsTable > tbody tr').remove();
    const settingsTable = $('#settingsTable > tbody')[0];

    // Add an entry to the settings table for each setting.
    for (const settingKey in settings) {
      let newRow = settingsTable.insertRow(settingsTable.rows.length);
      let keyCell = newRow.insertCell(0);
      let valueCell = newRow.insertCell(1);
      let eraseCell = newRow.insertCell(2);

      let eraseSpan = document.createElement('span');
      eraseSpan.className = 'glyphicon glyphicon-trash';
      eraseSpan.addEventListener('click', function () { eraseSetting(settingKey, newRow); });

      keyCell.innerHTML = settingKey;
      valueCell.innerHTML = settings[settingKey];
      eraseCell.appendChild(eraseSpan);
    }

    updateUIState(Object.keys(settings).length > 0);
  }

  function saveSetting () {
    let settingKey = $('#keyInput').val();
    let settingValue = $('#valueInput').val();

    tableau.extensions.settings.set(settingKey, settingValue);

    // Save the newest settings via the settings API.
    tableau.extensions.settings.saveAsync().then((currentSettings) => {
      // This promise resolves to a list of the current settings.
      // Rebuild the UI with that new list of settings.
      buildSettingsTable(currentSettings);

      // Clears the settings of content.
      $('#settingForm').get(0).reset();
    });
  }

  // This helper updates the UI depending on whether or not there are settings
  // that exist in the dashboard.  Accepts a boolean.
  function updateUIState(settingsExist) {
    if (settingsExist) {
      $('#settingsTable').removeClass('hidden').addClass('show');
      $('#noSettingsWarning').removeClass('show').addClass('hidden');
    } else {
      $('#noSettingsWarning').removeClass('hidden').addClass('show');
      $('#settingsTable').removeClass('show').addClass('hidden');
    }
  }

    // This variable will save off the function we can call to unregister listening to marks-selected events
    let unregisterEventHandlerFunction;
    function loadSelectedMarks(worksheetName) {
        // Remove any existing event listeners
        if (unregisterEventHandlerFunction) {
            unregisterEventHandlerFunction();
        }

        // Get the worksheet object we want to get the selected marks for
        const worksheet = getSelectedSheet(worksheetName);

        // Set our title to an appropriate value
        $('#selected_marks_title').text(worksheet.name);

        // Call to get the selected marks for our sheet
        worksheet.getSelectedMarksAsync().then(function(marks) {
            // Get the first DataTable for our selected marks (usually there is just one)
            const worksheetData = marks.data[0];

            // Map our data into the format which the data table component expects it
            const data = worksheetData.data.map(function(row, index) {
                const rowData = row.map(function(cell) {
                    return cell.formattedValue;
                });

                return rowData;
            });

            const columns = worksheetData.columns.map(function(column) {
                return {
                    title: column.fieldName
                };
            });

            // Populate the data table with the rows and columns we just pulled out
            populateDataTable(data, columns);
        });

        // Add an event listener for the selection changed event on this sheet.
        unregisterEventHandlerFunction = worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, function(selectionEvent) {
            // When the selection changes, reload the data
            loadSelectedMarks(worksheetName);
        });
    }

  function populateDataTable(data, columns) {
    // Do some UI setup here to change the visible section and reinitialize the table
    $('#data_table_wrapper').empty();

    if (data.length > 0) {
      $('#no_data_message').css('display', 'none');
      $('#data_table_wrapper').append(`<table id='data_table' class='table table-striped table-bordered'></table>`);

      // Do some math to compute the height we want the data table to be
      var top = $('#data_table_wrapper')[0].getBoundingClientRect().top;
      var height = $(document).height() - top - 130;

      // Initialize our data table with what we just gathered
      $('#data_table').DataTable({
          data: data,
          columns: columns,
          autoWidth: false,
          deferRender: true,
          scroller: true,
          scrollY: height,
          scrollX: true,
          dom: "<'row'<'col-sm-6'i><'col-sm-6'f>><'row'<'col-sm-12'tr>>" // Do some custom styling
      });
    } else {
      // If we didn't get any rows back, there must be no marks selected
      $('#no_data_message').css('display', 'inline');
    }
  }

  function getSelectedSheet(worksheetName) {
    // Go through all the worksheets in the dashboard and find the one we want
    return tableau.extensions.dashboardContent.dashboard.worksheets.find(function(sheet) {
      return sheet.name === worksheetName;
    });
  }
})();
