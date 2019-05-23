import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n.use(LanguageDetector).init({
  // we init with resources
  resources: {
    en: {
      translations: {
        'ethToSysButton': 'Ethereum To Syscoin',
        'sysToEthButton': 'Syscoin To Ethereum',
        'introHead': 'Welcome to the official Syscoin to Ethereum Bridge wizard!',
        'introDescription': 'This is a wizard for a bridge',
        'step1': 'Step 1',
        'step2': 'Step 2',
        'step3': 'Step 3',
        'step4': 'Step 4',
        'step5': 'Step 5',
        'step6': 'Step 6',
        'step1es': 'Step 1',
        'step2es': 'Step 2',
        'step3es': 'Step 3',
        'step4es': 'Step 4',
        'repoUrl': 'https://github.com/syscoin/sysethereum-contracts',
        'nextTextOnFinalActionStep': 'Finish',
        'nextButtonText': 'Next',
        'backButtonText': 'Back',
        'stepUseTestnet': 'Please configure your metamask to connect to the Rinkeby Ethereum network',
        'stepUseMainnet': 'Please configure your metamask to connect to the Main Ethereum network',
        'stepSuperblock': 'Could not connect to Superblock contract, try again in a few minutes or contact the administrator if issue persists',
        'step1Head': 'Welcome to the official Syscoin to Ethereum Bridge wizard!',
        'step1Description': 'This is a wizard for a bridge for users of Syscoin to walk trustlessly over to Ethereum without any counterparties. A notion of Superblocks is used to aggregate blocks every hour and post the merkle root hash of the aggregate block to an Ethereum contract. An SPV proof of the superblock as well as the Syscoin transaction when walking over the bridge helps to unlock tokens on an ERC20 token that is connected to Syscoin and participating Syscoin Assets. Please click on the Next button below to proceed. The smart contracts can be found here:',
        'step1CurrentSuperblock': 'Superblock Information',
        'step1SuperblockId': 'Superblock ID',
        'step1SuperblockHeight': 'Current Superblock Height',
        'step1SuperblockBlockHeight': 'Current Syscoin Blockheight',
        'step1MerkleRoot': 'Merkle Root',
        'step1LastBlockTime': 'Current Syscoin Block Time',
        'step1LastBlockHash': 'Current Syscoin Blockhash',
        'step1PreviousBlockTime': 'Difficulty Adjustment Time',
        'step1PreviousBlockBits': 'Previous Syscoin Difficulty Bits',
        'step1SuperblockApproved': 'Superblock Approved',
        'step1SuperblockAddress' : 'Superblock Contract Address',
        'step1SuperblockParentId': 'Previous Superblock ID',
        'step1SearchBox': 'Enter a hash or height to locate a Superblock...',
        'step1ESHead': 'Welcome to the official Ethereum to Syscoin Bridge wizard!',
        'step1ESDescription': 'This is a wizard for a bridge for users of Ethereum who has previously walked over from Syscoin to move back trustlessly. An SPV proof of the Ethereum burn transaction is required to move back to Syscoin. Please enter details about which asset to move back to Syscoin. Enter "0" for Asset GUID and "0xc2fc530b98108f656ef16cd23feb0f9fea65acec" as the Ethereum SYSX Contract if moving Syscoin over otherwise enter the GUID and contract of the Asset token you are moving back to Syscoin.',
        'step1ESContractLabel': 'Ethereum SYSX Contract',
        'step1SEContract': 'A valid Ethereum contract representing the SYSX token is required',
        'step1ESEnterContract': 'Enter contract address...',
        'step1ESFromAccountLabel': 'Ethereum account',
        'step1ESEnterFromAccount': 'Enter your ethereum token address...',
        'step1ESWitnessAddressLabel': 'Syscoin Address',
        'step1ESEnterWitnessAddress': 'Enter receiving Syscoin address...',
        'step1ESButton': 'Burn Ethereum Token',
        'step2ESHead': 'Step 2: Build a raw unsigned Syscoin Mint transaction',
        'step2ESDescription': 'Please enter the Transaction ID from your Ethereum burn transaction below if it is not already auto-filled. Click Generate to create the raw unsigned transaction before proceeding to the next step.',
        'step2ESEnterTxid': 'Enter Ethereum Transaction Hash (Txid)...',
        'step2ESTxid': 'A valid Ethereum TXID is required',
        'step2ESInvalidProof': 'Invalid Transaction Proof - Error: ',
        'step2Head': 'Step 2: Build a raw unsigned Syscoin Burn transaction',
        'step2Description': 'You may skip this step if you already have an unsigned burn transaction by putting it into the Raw Transaction input box below. Please fill out asset (if applicable), amount, address and then click Generate to create the raw unsigned transaction before proceeding to the next step. If you already have a Transaction ID then you may skip ahead to Step 3.',
        'step2Asset': 'A valid Syscoin Asset GUID is required',
        'step2AssetLabel': 'Asset GUID',
        'step2RawTx': 'A valid Syscoin raw transaction is required',
        'step2RawTxLabel': "Syscoin Raw Unsigned Transaction",
        'step2Amount': 'A valid amount is required',
        'step2EthAddress': 'A valid Ethereum address is required',
        'step2EthAddressLabel': 'Ethereum Address',
        'step2FundingAddress': 'A valid Syscoin address is required',
        'step2FundingAddressLabel': 'Syscoin Funding Address',
        'step2EnterAsset': 'Enter Asset GUID here if applicable...',
        'step2EnterFundingAddress': 'Enter Syscoin funding address here...',
        'step2EnterAmount': 'Amount to transfer...',
        'step2AmountLabel': 'Amount',
        'step2EnterEthAddress': 'Ethereum address of recipient...',
        'step2Button': 'Generate Transaction',
        'step2EnterRawTx': 'Syscoin raw unsigned transaction...',
        'step3Head': 'Step 3: Sign/Broadcast Transaction and Lookup Blockhash',
        'step3Description': 'Please copy the raw transaction below and open your local Syscoin wallet (Syscoin Core is preferred). Enter the command "signrawtransactionwithwallet" followed by the raw transaction. With the resulting hex string enter "sendrawtransaction" and enter the resulting Transaction ID below. You may skip this step if you already have a Transacation ID. Then click on Lookup to find the blockhash once it is confirmed in the Syscoin blockchain.',
        'step3ESDescription': 'Please copy the raw transaction below and open your local Syscoin wallet (Syscoin Core is preferred). Enter the command "signrawtransactionwithwallet" followed by the raw transaction. With the resulting hex string enter "sendrawtransaction" and enter the resulting Transaction ID below. Then click on Lookup to find the blockhash once it is confirmed in the Syscoin blockchain.',
        'step3TxidLabel': 'Transaction ID',
        'step3Txid': 'A valid Syscoin TXID is required',
        'step3EnterTxid': 'Enter Syscoin Transaction Hash (Txid)...',
        'step3Button': 'Lookup',
        'step3BlockhashLabel': 'Block Hash',
        'step3EnterBlockHash': 'Enter valid Syscoin blockhash corrosponding with the txid...',
        'step3Blockhash': 'A valid blockhash which has confirmed and contains the txid is required',
        'step4Head': 'Step 4: Get SPV Proof to move to Ethereum',
        'step4Description': 'The button below will get the Syscoin Transaction SPV proof from Syscoin Core and then the Superblock SPV proof from a Syscoin Agent. Both are needed to proceed to the next step of completing an Ethereum transaction to the Superblock contract',
        'step4Button': 'Get SPV Proofs',
        'step4ButtonEnter': 'Please get SPV Proofs before proceeding',
        'step4SbStatusSuccess': 'SPV Proofs were sucessfully saved! Please proceed to click on the "Next" button below',
        'step4ESHead': 'Step 4: Complete!',
        'step4ESDescription': 'Transaction was successfully completed. You now can use your Syscoin or Syscoin Asset through the Syscoin network. You can view your transaction here: ',
        'step5Head': 'Step 5: Submit SPV Proof to Ethereum',
        'step5Description': 'The button below will submit the SPV proofs to the Superblock contract.',
        'step5Button': 'Submit SPV Proofs',
        'step5InstallMetamask': 'Please install Metamask to submit SPV proof to Ethereum...',
        'step5LoginMetamask': 'Please login to Metamask and try again...',
        'step5AuthMetamask': 'Authorizing with Metamask...',
        'step5Success': 'Success!',
        'step5PleaseWait': 'Please wait while the transaction is being mined...',
        'step5ReceiptStatus': 'Status',
        'step5ReceiptTxHash': 'Transaction ID',
        'step5ReceiptTxIndex': 'Transaction Index',
        'step5ReceiptFrom': 'From',
        'step5ReceiptTo': 'To',
        'step5ReceiptBlockhash': 'Blockhash',  
        'step5ReceiptBlocknumber': 'Block Number',  
        'step5ReceiptTotalGas': 'Cumulative Gas Used',  
        'step5ReceiptGas': 'Gas Used',
        'step5ReceiptConfirmations': 'Confirmations',
        'step5Download': 'Download Receipt Log',
        'step5ErrorEVMCheckLog': 'Error! EVM Rejection. Please check the Receipt Log for more details',
        'step5ErrorEventCheckLog': 'Error! Cannot find event in Transaction Receipt. Please check the Receipt Log for more details',
        'step6Head': 'Step 6: Complete!',
        'step6Description': 'Transaction was successfully completed. You now can use your Syscoin or Syscoin Asset on the Ethereum network through an ERC20. You can view your transaction here: '
      }
    },
    de: {
      translations: {
        'step1': 'Schritt 1',
        'step2': 'Schritt 2',
        'step3': 'Schritt 3',
        'step4': 'Schritt 4',
        'step5': 'Schritt 5',
        'step6': 'Schritt 6',
        'repoUrl': 'https://github.com/syscoin/sysethereum-contracts',
        'nextTextOnFinalActionStep': 'Speichern',
        'nextButtonText': 'Weiter',
        'backButtonText': 'Zurück',
        'step1Head': 'Schritt 1: Willkommen zum offiziellen React-StepZilla-Beispiel',
        'step1SourceDocs': 'de: This is a wizard for a bridge for users of Syscoin to walk trustlessly over to Ethereum without any counterparties. A notion of Superblocks is used to aggregate blocks every hour and post the merkle root hash of the aggregate block to an Ethereum contract. An SPV proof of the superblock as well as the Syscoin transaction when walking over the bridge helps to unlock tokens on an ERC20 token that is connected to Syscoin and participating Syscoin Assets. Please click on the Next button below to proceed. The smart contracts can be found here:',
        'step1CustomConfig': 'Dieses Beispiel verwendet diese benutzerdefinierte Konfiguration (die die Standardkonfiguration überschreibt):',
        'step1CurrentSuperblock': 'de: Superblock Information',
        'step1SuperblockId': 'de: Superblock ID',
        'step1SuperblockHeight': 'de: Current Superblock Height',
        'step1SuperblockBlockHeight': 'de: Current Syscoin Blockheight',
        'step1MerkleRoot': 'de: Merkle Root',
        'step1LastBlockTime': 'de: Current Syscoin Block Time',
        'step1LastBlockHash': 'de: Current Syscoin Blockhash',
        'step1PreviousBlockTime': 'de: Previous Syscoin Block Time',
        'step1PreviousBlockBits': 'de: Previous Syscoin Difficulty Bits',
        'step1SuperblockApproved': 'de: Superblock Approved',
        'step1SuperblockParentId': 'de: Previous Superblock ID',
        'step1SearchBox': 'de: Enter a hash or height to locate a Superblock...',
        'step1DefaultConfig': 'Die Standardkonfiguration ist...',
        'step2Head': 'Schritt 2: Pure Component Beispiel',
        'step2PureComponents': 'Sie können auch Pure React Components verwenden (ab v4.2.0)!',
        'step2ValidationLogic': '... aber Sie können hier keine Validierungslogik zur Verfügung stellen (d.h. Sie können keine',
        'step2Limitation': 'Methode schreiben und diese von StepZilla verwenden lassen, um zu bestimmen, ob es zum nächsten Schritt übergehen kann). Dies ist eine Einschränkung bei der Verwendung einer Pure Component.',
        'step2Checkpoint': '... also verwenden Sie eine Pure Component, wenn Sie nur einige Präsentationsinhalte anzeigen möchten und eine reguläre React-Komponente (die sich von React.Component ableitet), wenn Sie Validierungskontrollstellen auf Komponentenebene bereitstellen müssen über ',
        'step2JumpTo1': 'z.B, wie wir die Helfer-Methode der Methode jumpToStep verwenden, um zu Schritt 1 zurückzukehren.',
        'step3Head': 'Schritt 3: Beispiel für eine grundlegende JavaScript-Validierung',
        'step3JavaScriptValidation': 'Diese Beispielkomponente hat ein Formular, das eine lokale Standard-Basis-JavaScript-Validierung verwendet.',
        'step3Gender': 'Geschlecht',
        'step3PleaseSelect': 'Bitte wählen Sie',
        'step3Male': 'männlich',
        'step3Female': 'weiblich',
        'step3Other': 'anderes',
        'step3GenderVal': 'Eine Geschlechtsauswahl ist erforderlich.',
        'step3EmailVal': 'Eine gültige E-Mail ist erforderlich.',
        'step4Head': 'Schritt 4: Formularvalidierung am Beispiel "react-validation-mixin".',
        'step4EmergencyMail': 'Ihre Notfall-E-Mail-Adresse',
        'step4ShownExample': 'Wie in diesem Beispiel gezeigt, können Sie auch ',
        'step4HandleValidations': 'verwenden um Ihre Validierungen zu verwalten! (ab v4.3.2)!',
        'step4StepZillaSteps': '... so dass StepZilla-Step Komponenten entweder die grundlegende JS-Validierung oder die Higer Order Component (HOC) basierte Validierung mit React-Validation-Mixin verwenden können.',
        'step5Head': 'Schritt 5: Überprüfen Sie Ihre Daten und speichern Sie sie.',
        'step5Gender': 'Geschlecht',
        'step5Email': 'E-Mail',
        'step5EmergencyEmail': 'Notfall-E-Mail-Adresse',
        'step5JumpTo1': 'z.B., wie wir die Helfer-Methode der Methode jumpToStep verwenden, um zu Schritt 1 zurückzukehren.',
        'step5Promise': 'Speichern in der Cloud, bitte warten Sie (übrigens verwenden wir ein Promise, um dies zu tun :).....',
        'step6Head': 'Danke!',
        'step6DataUploaded': 'Daten wurden erfolgreich in der Cloud gespeichert......',
        'step6GoBack1': 'Sie haben die Daten aktualisiert, gehen Sie ',
        'step6GoBack2': 'zurück',
        'step6GoBack3': 'und speichern Sie erneut!',
      }
    }
  },
  fallbackLng: 'en',
  debug: true,

  // have a common namespace used around the full app
  ns: ['translations'],
  defaultNS: 'translations',

  keySeparator: false, // we use content as keys

  interpolation: {
    escapeValue: false, // not needed for react!!
    formatSeparator: ','
  },

  react: {
    wait: true
  }
});

export default i18n;
