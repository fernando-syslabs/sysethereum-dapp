import React, { Component } from "react";
import Web3 from "web3";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import assetabierc20 from "../SyscoinERC20I";
import assetabierc721 from "../SyscoinERC721I";
import assetabierc1155 from "../SyscoinERC1155I";
import erc20Managerabi from "../SyscoinERC20Manager";
import CONFIGURATION from "../config";
// This function detects most providers injected at window.ethereum
import detectEthereumProvider from "@metamask/detect-provider";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const sjs = require("syscoinjs-lib");
const web3 = new Web3(Web3.givenProvider);
class Step1ES extends Component {
  constructor(props) {
    super(props);
    let storageExists = typeof Storage !== "undefined";
    this.state = {
      sysxContract:
        (storageExists && localStorage.getItem("sysxContract")) ||
        props.getStore().sysxContract,
      sysxFromAccount:
        (storageExists && localStorage.getItem("sysxFromAccount")) ||
        props.getStore().sysxFromAccount,
      toSysAmount:
        (storageExists && localStorage.getItem("toSysAmount")) ||
        props.getStore().toSysAmount,
      syscoinWitnessAddress:
        (storageExists && localStorage.getItem("syscoinWitnessAddress")) ||
        props.getStore().syscoinWitnessAddress,
      receiptStatus: props.getStore().receiptStatus,
      receiptTxHash:
        (storageExists && localStorage.getItem("receiptTxHash")) ||
        props.getStore().receiptTxHash,
      receiptTxIndex: props.getStore().receiptTxIndex,
      receiptFrom: props.getStore().receiptFrom,
      receiptTo: props.getStore().receiptTo,
      receiptBlockhash: props.getStore().receiptBlockhash,
      receiptBlocknumber: props.getStore().receiptBlocknumber,
      receiptTotalGas: props.getStore().receiptTotalGas,
      receiptGas: props.getStore().receiptGas,
      receiptObj: props.getStore().receiptObj,
      working: false,
      assetType: 'SYS',
      tokenId: '',
    };
    this.submitProofs = this.submitProofs.bind(this);
    this.downloadReceipt = this.downloadReceipt.bind(this);
    this.validationCheck = this.validationCheck.bind(this);
    this.isValidated = this.isValidated.bind(this);
    this.setStateFromReceipt = this.setStateFromReceipt.bind(this);
  }
  componentDidMount() {}
  isValidated() {
    const userInput = this._grabUserInput(); // grab user entered vals
    const validateNewInput = this._validateData(userInput); // run the new input against the validator
    let isDataValid = false;

    // if full validation passes then save to store and pass as valid
    if (
      Object.keys(validateNewInput).every((k) => {
        return validateNewInput[k] === true;
      })
    ) {
      if (
        this.props.getStore().receiptTxHash !== userInput.receiptTxHash ||
        this.props.getStore().toSysAmount !== userInput.toSysAmount ||
        this.props.getStore().sysxFromAccount !== userInput.sysxFromAccount ||
        this.props.getStore().syscoinWitnessAddress !==
          userInput.syscoinWitnessAddress
      ) {
        // only update store of something changed
        this.props.updateStore({
          ...userInput,
          savedToCloud: false, // use this to notify step3 that some changes took place and prompt the user to save again
        }); // Update store here (this is just an example, in reality you will do it via redux or flux)
      }

      isDataValid = true;
    } else {
      // if anything fails then update the UI validation state but NOT the UI Data State
      this.setState(
        Object.assign(
          userInput,
          validateNewInput,
          this._validationErrors(validateNewInput)
        )
      );
    }

    return isDataValid;
  }
  componentWillUnmount() {}
  downloadReceipt() {
    const element = document.createElement("a");
    const file = new Blob(
      [JSON.stringify(this.state.receiptObj, null, "   ")],
      { type: "text/plain" }
    );
    element.href = URL.createObjectURL(file);
    element.download = "receipt.txt";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }
  saveToLocalStorage() {
    if (typeof Storage !== "undefined") {
      // Code for localStorage/sessionStorage.
      localStorage.setItem("sysxContract", this.refs.sysxContract.value);
      localStorage.setItem("sysxFromAccount", this.refs.sysxFromAccount.value);
      localStorage.setItem("toSysAmount", this.refs.toSysAmount.value);
      localStorage.setItem(
        "syscoinWitnessAddress",
        this.refs.syscoinWitnessAddress.value
      );
      localStorage.setItem("receiptTxHash", this.state.receiptTxHash);
    } else {
      // Sorry! No Web Storage support..
    }
  }
  validationCheck() {
    if (!this._validateOnDemand) return;

    const userInput = this._grabUserInput(); // grab user entered vals
    const validateNewInput = this._validateData(userInput); // run the new input against the validator

    this.setState(
      Object.assign(
        userInput,
        validateNewInput,
        this._validationErrors(validateNewInput)
      )
    );
  }

  _validateData(data) {
    let valid = {
      sysxContractVal: true,
      sysxFromAccountVal: true,
      tokenIdVal: true,
      toSysAmountVal: true,
      syscoinWitnessAddressVal: true,
      receiptStatusVal: true,
      receiptTxHashVal: true,
      receiptTxIndexVal: true,
      receiptFromVal: true,
      receiptToVal: true,
      receiptBlockhashVal: true,
      receiptBlocknumberVal: true,
      receiptTotalGasVal: true,
      receiptGasVal: true,
      receiptObjVal: true,
    };
  
    if ((this.state.assetType === 'ERC721' || this.state.assetType === 'ERC1155') && (!data.tokenId || data.tokenId.trim() === '')) {
      valid.tokenIdVal = false;
    }
    if ((this.state.assetType === 'SYS') && (!data.sysxContract || data.sysxContract.trim() === '')) {
      valid.sysxContractVal = false;
    }
  
    return valid;
  }

  _validationErrors(val) {
    const errMsgs = {
      sysxFromAccountValMsg: val.sysxFromAccountVal
        ? ""
        : this.props.t("step2EthAddress"),
      tokenIdValMsg: val.tokenIdVal ? "" : this.props.t("step2TokenId"),
      sysxContractValMsg: val.sysxContractVal ? "" : this.props.t("step2SYSXContract"),
      toSysAmountValMsg: val.toSysAmountVal ? "" : this.props.t("step2Amount"),
      syscoinWitnessAddressValMsg: val.syscoinWitnessAddressVal
        ? ""
        : this.props.t("step2FundingAddress"),
      
      receiptStatusValMsg: "",
      receiptTxHashValMsg: "",
      receiptTxIndexValMsg: "",
      receiptFromValMsg: "",
      receiptToValMsg: "",
      receiptBlockhashValMsg: "",
      receiptBlocknumberValMsg: "",
      receiptTotalGasValMsg: "",
      receiptGasValMsg: "",
      receiptObjValMsg: "",
    };
    return errMsgs;
  }

  _grabUserInput() {
    return {
      sysxContract: this.state.sysxContract,
      sysxFromAccount: this.refs.sysxFromAccount.value,
      toSysAmount: this.state.assetType !== 'ERC721' ? this.refs.toSysAmount.value : null,
      syscoinWitnessAddress: this.refs.syscoinWitnessAddress.value,
      receiptTxHash: this.state.receiptTxHash,
      assetType: this.state.assetType,
      tokenId: this.state.tokenId
    };
  }
  setStateFromReceipt(receipt, error, confirmation, validateNewInput) {
    if (
      receipt.transactionHash &&
      this.state.receiptTxHash !== receipt.transactionHash
    ) {
      return;
    }
    if (
      receipt.status !== undefined &&
      receipt.status !== "1" &&
      receipt.status !== true &&
      receipt.status !== "true" &&
      receipt.status !== "0x1"
    ) {
      error = this.props.t("step3ErrorEVMCheckLog");
    }

    validateNewInput.receiptObj = receipt;
    validateNewInput.receiptStatus = receipt.status === true ? "true" : "false";
    validateNewInput.receiptTxHash = receipt.transactionHash;
    validateNewInput.receiptTxIndex = receipt.transactionIndex;
    validateNewInput.receiptFrom = receipt.from;
    validateNewInput.receiptTo = receipt.to;
    validateNewInput.receiptBlockhash = receipt.blockHash;
    validateNewInput.receiptBlocknumber = receipt.blockNumber;
    validateNewInput.receiptTotalGas = receipt.cumulativeGasUsed;
    validateNewInput.receiptGas = receipt.gasUsed;
    validateNewInput.receiptConf = confirmation;
    validateNewInput.buttonVal = error !== null ? false : true;
    validateNewInput.buttonValMsg =
      error !== null ? error : this.props.t("step3Success");
  }

  async getAssetContract(guid, validateNewInput) {
    if (guid.length > 0) {
      try {
        let results = await sjs.utils.fetchBackendAsset(
          CONFIGURATION.BlockbookAPIURL,
          guid
        );
        if (results.error) {
          validateNewInput.buttonVal = false;
          validateNewInput.buttonValMsg = results.error;
          return "";
        } else if (results) {
          return results.contract;
        }
      } catch (e) {
        validateNewInput.buttonVal = false;
        validateNewInput.buttonValMsg =
          e && e.message ? e.message : this.props.t("genericError");
        return "";
      }
    }
    return "";
  }
  freezeBurn(
    syscoinERC20Manager,
    validateNewInput,
    amount,
    sysxContract,
    tokenId,
    syscoinWitnessAddress,
    userInput,
    fromAccount
  ) {
    let thisObj = this

    thisObj.state.receiptObj = null;

    syscoinERC20Manager.methods
      .freezeBurn(amount, sysxContract, tokenId, syscoinWitnessAddress)
      .send({
        from: fromAccount,
        gas: 400000,
        value: tokenId === 0 ? amount : undefined,
        transactionPollingTimeout: 1800,
      })
      .once("transactionHash", function (hash) {
        validateNewInput.buttonVal = true;
        validateNewInput.receiptTxHash = hash;
        validateNewInput.buttonValMsg = thisObj.props.t("step3AuthMetamask");
        thisObj.setState(
          Object.assign(
            userInput,
            validateNewInput,
            thisObj._validationErrors(validateNewInput)
          )
        );
        thisObj.setState({ working: true });
      })
      .once("confirmation", function (confirmationNumber, receipt) {
        if (thisObj.state.receiptObj === null) {
          thisObj.setStateFromReceipt(
            receipt,
            null,
            confirmationNumber,
            validateNewInput
          );
          thisObj.setState(
            Object.assign(
              userInput,
              validateNewInput,
              thisObj._validationErrors(validateNewInput)
            )
          );
          thisObj.setState({ working: false });
          thisObj.saveToLocalStorage();
        } else {
          validateNewInput.receiptConf = confirmationNumber;
          thisObj.setState(
            Object.assign(
              userInput,
              validateNewInput,
              thisObj._validationErrors(validateNewInput)
            )
          );
        }
      })
      .on("error", (error, receipt) => {
        thisObj.setState({ working: false });
        if (error.message.length <= 512 && error.message.indexOf("{") !== -1) {
          error = JSON.parse(
            error.message.substring(error.message.indexOf("{"))
          );
        }
        let message = error.message.toString();
        if (message.indexOf("might still be mined") === -1) {
          if (receipt) {
            thisObj.setStateFromReceipt(receipt, message, 0, validateNewInput);
            thisObj.setState(
              Object.assign(
                userInput,
                validateNewInput,
                thisObj._validationErrors(validateNewInput)
              )
            );
          } else {
            validateNewInput.buttonVal = false;
            validateNewInput.buttonValMsg = message;
            thisObj.setState(
              Object.assign(
                userInput,
                validateNewInput,
                thisObj._validationErrors(validateNewInput)
              )
            );
          }
        }
      });
  }
  isString(s) {
    return typeof s === "string" || s instanceof String;
  }
  toBaseUnit(value, decimals, BN) {
    if (!this.isString(value)) {
      console.error("Pass strings to prevent floating point precision issues.");
      return;
    }
    const ten = new BN(10);
    const base = ten.pow(new BN(decimals));

    // Is it negative?
    let negative = value.substring(0, 1) === "-";
    if (negative) {
      value = value.substring(1);
    }

    if (value === ".") {
      console.error(
        `Invalid value ${value} cannot be converted to` +
          ` base unit with ${decimals} decimals.`
      );
      return;
    }

    // Split it into a whole and fractional part
    let comps = value.split(".");
    if (comps.length > 2) {
      console.error("Too many decimal points");
      return;
    }

    let whole = comps[0],
      fraction = comps[1];

    if (!whole) {
      whole = "0";
    }
    if (!fraction) {
      fraction = "0";
    }
    if (fraction.length > decimals) {
      console.error("Too many decimal places");
      return;
    }

    while (fraction.length < decimals) {
      fraction += "0";
    }

    whole = new BN(whole);
    fraction = new BN(fraction);
    let wei = whole.mul(base).add(fraction);

    if (negative) {
      wei = wei.neg();
    }

    return new BN(wei.toString(10), 10);
  }
  async submitProofs() {
    let userInput = this._grabUserInput();
    let validateNewInput = this._validateData(userInput);
  
    let valid = true;
  
    if (this.state.assetType !== 'SYS' && (!userInput.sysxContract || userInput.sysxContract.trim() === '')) {
      validateNewInput.sysxContractVal = false;
      valid = false;
    }
    if ((this.state.assetType === 'ERC721' || this.state.assetType === 'ERC1155') && (!userInput.tokenId || userInput.tokenId.trim() === '')) {
      validateNewInput.tokenIdVal = false;
      valid = false;
    }
    if ((this.state.assetType !== 'ERC721') && (!userInput.toSysAmount || userInput.toSysAmount === '')) {
      validateNewInput.toSysAmountVal = false;
      valid = false;
    }
    if (!userInput.syscoinWitnessAddress || userInput.syscoinWitnessAddress === '') {
      validateNewInput.syscoinWitnessAddressVal = false;
      valid = false;
    }
    if (!userInput.sysxFromAccount || userInput.sysxFromAccount === '') {
      validateNewInput.sysxFromAccountVal = false;
      valid = false;
    }
    if ((this.state.assetType === 'ERC721' || this.state.assetType === 'ERC1155') && (!userInput.tokenId || userInput.tokenId === '')) {
      validateNewInput.tokenIdVal = false;
      valid = false;
    }
  
    if (!valid) {
      this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
      return;
    }
  
    const provider = await detectEthereumProvider();
    if (!provider) {
      validateNewInput.buttonVal = false;
      validateNewInput.buttonValMsg = this.props.t("step3InstallMetamask");
      this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
      return;
    }
    let accounts = null;
    try {
      accounts =
      await window.ethereum.request({
        method: "eth_accounts",
        params: [],
      });
    } catch (accountsError) {
      console.log('Couldnt fetch accounts');
    }
    if (!accounts || !accounts[0] || accounts[0] === "undefined") {
      validateNewInput.buttonVal = false;
      validateNewInput.buttonValMsg = this.props.t("step3LoginMetamask");
      this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
      await window.ethereum.request({
        method: "eth_requestAccounts",
        params: [],
      });
      return;
    }
  
    // Add this after checking provider availability
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CONFIGURATION.ChainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: CONFIGURATION.ChainId,
                chainName: CONFIGURATION.ChainName,
                nativeCurrency: {
                  name: CONFIGURATION.NativeCurrencyName,
                  symbol: CONFIGURATION.NativeCurrencySymbol,
                  decimals: 18,
                },
                rpcUrls: [CONFIGURATION.Web3URL],
                blockExplorerUrls: [CONFIGURATION.NEVMExplorerURL],
              },
            ],
          });
        } catch (addError) {
          validateNewInput.buttonVal = false;
          validateNewInput.buttonValMsg = addError.message;
          this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
          this.setState({ working: false });
          return;
        }
      } else {
        validateNewInput.buttonVal = false;
        validateNewInput.buttonValMsg = switchError.message;
        this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
        this.setState({ working: false });
        return;
      }
    }

    let currentChainId = await web3.eth.getChainId();
    if (currentChainId !== parseInt(CONFIGURATION.ChainId, 16)) {
      validateNewInput.buttonVal = false;
      validateNewInput.buttonValMsg = "Invalid network";
      this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
      this.setState({ working: false });
      return;
    }
    
    // Asset ABI selection (you already had this mostly correct)
    let assetABI;
    switch (this.state.assetType) {
      case 'ERC721': assetABI = assetabierc721; break;
      case 'ERC1155': assetABI = assetabierc1155; break;
      default: assetABI = assetabierc20;
    }
    let syscoinERC20Manager = new web3.eth.Contract(
      erc20Managerabi,
      CONFIGURATION.ERC20Manager
    );
    let contractBase = new web3.eth.Contract(assetABI, userInput.sysxContract);
    let fromAccount = userInput.sysxFromAccount;
    let syscoinWitnessAddress = userInput.syscoinWitnessAddress;
    let tokenId = (this.state.assetType === 'ERC721' || this.state.assetType === 'ERC1155') ? userInput.tokenId : 0;
    let thisObj = this;
    let amount = (this.state.assetType === 'ERC721') ? '1' : this.toBaseUnit(userInput.toSysAmount, 18, web3.utils.BN);

    // ERC20 Allowance check
    if (this.state.assetType === 'ERC20') {
      let allowance = await contractBase.methods.allowance(fromAccount, CONFIGURATION.ERC20Manager).call();
      allowance = web3.utils.toBN(allowance.toString());

      if (allowance.lt(amount)) {
        await contractBase.methods.approve(CONFIGURATION.ERC20Manager, amount.toString())
          .send({ from: fromAccount, gas: 400000, transactionPollingTimeout: 1800 })
          .once("transactionHash", (hash) => {
            validateNewInput.buttonVal = true;
            validateNewInput.receiptTxHash = hash;
            validateNewInput.buttonValMsg = this.props.t("step3AuthAllowanceMetamask");
            this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
          })
          .once("confirmation", (confirmationNumber, receipt) => {
            thisObj.freezeBurn(
              syscoinERC20Manager,
              validateNewInput,
              amount.toString(),
              userInput.sysxContract,
              tokenId,
              syscoinWitnessAddress,
              userInput,
              fromAccount
            );
          })
          .on("error", (error, receipt) => {
            this.setState({ working: false });
            validateNewInput.buttonVal = false;
            validateNewInput.buttonValMsg = error.message;
            this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
          });
        return;
      }
    } else if (this.state.assetType === 'ERC721' || this.state.assetType === 'ERC1155') {
        let approved = await contractBase.methods.isApprovedForAll(fromAccount, CONFIGURATION.ERC20Manager).call();
        if (!approved) {
          await contractBase.methods.setApprovalForAll(CONFIGURATION.ERC20Manager, true)
            .send({ from: fromAccount, gas: 400000, transactionPollingTimeout: 1800 })
            .once("transactionHash", (hash) => {
              validateNewInput.buttonValMsg = this.props.t("step3AuthAllowanceMetamask");
              this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
            })
            .once("confirmation", (confirmationNumber, receipt) => {
              thisObj.freezeBurn(
                syscoinERC20Manager,
                validateNewInput,
                amount.toString(),
                userInput.sysxContract,
                tokenId,
                syscoinWitnessAddress,
                userInput,
                fromAccount
              );
            })
            .on("error", error => {
              this.setState({ working: false });
              validateNewInput.buttonVal = false;
              validateNewInput.buttonValMsg = error.message;
              this.setState(Object.assign(userInput, validateNewInput, this._validationErrors(validateNewInput)));
            });
          return;
      }
    }
    this.freezeBurn(
      syscoinERC20Manager,
      validateNewInput,
      amount.toString(),
      userInput.sysxContract? userInput.sysxContract: ZERO_ADDRESS,
      tokenId,
      syscoinWitnessAddress,
      userInput,
      fromAccount
    );
  }

  render() {
    // explicit class assigning based on validation
    let notValidClasses = {};
    if (typeof this.state.buttonVal == "undefined" || this.state.buttonVal) {
      notValidClasses.buttonCls = "has-success";
      notValidClasses.buttonValGrpCls = "val-success-tooltip mb30"; // use 'active' class if you want to actually use this (green) tooltip
    } else {
      notValidClasses.buttonCls = "has-error";
      notValidClasses.buttonValGrpCls = "val-err-tooltip mb30";
    }
    if (
      typeof this.state.toSysAmountVal == "undefined" ||
      this.state.toSysAmountVal
    ) {
      notValidClasses.toSysAmountCls = "has-success";
      notValidClasses.toSysAmountValGrpCls = "val-success-tooltip";
    } else {
      notValidClasses.toSysAmountCls = "has-error";
      notValidClasses.toSysAmountValGrpCls = "val-err-tooltip";
    }
    if (
      typeof this.state.syscoinWitnessAddressVal == "undefined" ||
      this.state.syscoinWitnessAddressVal
    ) {
      notValidClasses.syscoinWitnessAddressCls = "has-success";
      notValidClasses.syscoinWitnessAddressValGrpCls = "val-success-tooltip";
    } else {
      notValidClasses.syscoinWitnessAddressCls = "has-error";
      notValidClasses.syscoinWitnessAddressValGrpCls = "val-err-tooltip";
    }
    if (
      typeof this.state.sysxFromAccountVal == "undefined" ||
      this.state.sysxFromAccountVal
    ) {
      notValidClasses.sysxFromAccountCls = "has-success";
      notValidClasses.sysxFromAccountValGrpCls = "val-success-tooltip";
    } else {
      notValidClasses.sysxFromAccountCls = "has-error";
      notValidClasses.sysxFromAccountValGrpCls = "val-err-tooltip";
    }
    if (
      typeof this.state.tokenIdVal == "undefined" ||
      this.state.tokenIdVal
    ) {
      notValidClasses.tokenIdCls = "has-success";
      notValidClasses.tokenIdValGrpCls = "val-success-tooltip";
    } else {
      notValidClasses.tokenIdCls = "has-error";
      notValidClasses.tokenIdValGrpCls = "val-err-tooltip";
    }
    if (
      typeof this.state.sysxContractVal == "undefined" ||
      this.state.sysxContractVal
    ) {
      notValidClasses.sysxContractCls = "has-success";
      notValidClasses.sysxContractValGrpCls = "val-success-tooltip";
    } else {
      notValidClasses.sysxContractCls = "has-error";
      notValidClasses.sysxContractValGrpCls = "val-err-tooltip";
    }
    return (
      <div className="step step1es">
        <div className="row">
          <form id="Form" className="form-horizontal">
            <div className="form-group">
              <label className="col-md-12">
                <h1>{this.props.t("step1ESHead")}</h1>
                <h3
                  dangerouslySetInnerHTML={{
                    __html: this.props.t("step1ESDescription"),
                  }}
                ></h3>
              </label>
              <div className="row">
                <div className="col-md-12">
                  <label className="control-label col-md-4">Asset Type</label>
                  <div>
                    <select
                      className="form-control"
                      value={this.state.assetType}
                      onChange={(e) => this.setState({ assetType: e.target.value })}
                    >
                      <option value="SYS">SYS (Native)</option>
                      <option value="ERC20">ERC20 Token</option>
                      <option value="ERC721">ERC721 NFT</option>
                      <option value="ERC1155">ERC1155 Multi-token</option>
                    </select>
                  </div>
                </div>
              </div>
              {this.state.assetType !== 'SYS' && (
                <div className="row">
                  <div className="col-md-12">
                  <label className="control-label col-md-4">
                    {this.props.t("step1ESSYSXContractLabel")}
                  </label>
                  <div className={notValidClasses.sysxContractCls}>
                    <input
                      type="text"
                      placeholder={this.props.t("step1ESEnterSYSXContract")}
                      className="form-control"
                      value={this.state.sysxContract}
                      onChange={(e) => this.setState({ sysxContract: e.target.value })}
                    />
                    <div className={notValidClasses.sysxContractValGrpCls}>
                      {this.state.sysxContractValMsg}
                    </div>
                  </div>
                </div>
              </div>
              )}
              {(this.state.assetType === 'ERC721' || this.state.assetType === 'ERC1155') && (
                <div className="row">
                  <div className="col-md-12">
                    <label className="control-label col-md-4">Token ID</label>
                    <div className={notValidClasses.tokenIdCls}>
                      <input
                        type="number"
                        className="form-control"
                        placeholder={this.props.t("step1ESEnterToken")}
                        value={this.state.tokenId}
                        onChange={(e) => this.setState({ tokenId: e.target.value })}
                      />
                      <div className={notValidClasses.tokenIdValGrpCls}>
                        {this.state.tokenIdValMsg}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="row">
                <div className="col-md-12">
                  <label className="control-label col-md-4">
                    {this.props.t("step1ESFromAccountLabel")}
                  </label>
                  <div className={notValidClasses.sysxFromAccountCls}>
                    <input
                      ref="sysxFromAccount"
                      autoComplete="off"
                      type="text"
                      placeholder={this.props.t("step1ESEnterFromAccount")}
                      className="form-control"
                      defaultValue={this.state.sysxFromAccount}
                    />
                    <div className={notValidClasses.sysxFromAccountValGrpCls}>
                      {this.state.sysxFromAccountValMsg}
                    </div>
                  </div>
                </div>
              </div>
              {this.state.assetType !== 'ERC721' && (
              <div className="row">
                <div className="col-md-12">
                  <label className="control-label col-md-4">
                    {this.props.t("step2AmountLabel")}
                  </label>
                  <div className={notValidClasses.toSysAmountCls}>
                    <input
                      ref="toSysAmount"
                      autoComplete="off"
                      type="number"
                      placeholder={this.props.t("step2EnterAmount")}
                      className="form-control"
                      required
                      defaultValue={this.state.toSysAmount}
                    />
                    <div className={notValidClasses.toSysAmountValGrpCls}>
                      {this.state.toSysAmountValMsg}
                    </div>
                  </div>
                </div>
              </div>)}
              <div className="row">
                <div className="col-md-12">
                  <label className="control-label col-md-4">
                    {this.props.t("step1ESWitnessAddressLabel")}
                  </label>
                  <div className={notValidClasses.syscoinWitnessAddressCls}>
                    <input
                      ref="syscoinWitnessAddress"
                      autoComplete="off"
                      type="text"
                      placeholder={this.props.t("step1ESEnterWitnessAddress")}
                      className="form-control"
                      required
                      defaultValue={this.state.syscoinWitnessAddress}
                    />
                    <div
                      className={notValidClasses.syscoinWitnessAddressValGrpCls}
                    >
                      {this.state.syscoinWitnessAddressValMsg}
                    </div>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-md-4 col-sm-12 col-centered">
                  <div className={notValidClasses.buttonCls}>
                    <button
                      disabled={this.state.working}
                      type="button"
                      className="form-control btn btn-default formbtn"
                      aria-label={this.props.t("step1ESButton")}
                      onClick={this.submitProofs}
                    >
                      <span
                        className="glyphicon glyphicon-send"
                        aria-hidden="true"
                      >
                        &nbsp;
                      </span>
                      {this.props.t("step1ESButton")}
                    </button>
                    <div className={notValidClasses.buttonValGrpCls}>
                      {this.state.buttonValMsg}
                    </div>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-md-12">
                  <Tabs>
                    <TabList>
                      <Tab>{this.props.t("tabGeneral")}</Tab>
                      <Tab>{this.props.t("tabAdvanced")}</Tab>
                    </TabList>
                    <TabPanel>
                      <code className="block">
                        <span className="dataname">
                          {this.props.t("step3ReceiptStatus")}:
                        </span>{" "}
                        <span className="result">
                          {this.state.receiptStatus}
                        </span>
                        <br />
                        <span className="dataname">
                          {this.props.t("step3ReceiptTxHash")}:
                        </span>{" "}
                        <span className="result">
                          {this.state.receiptTxHash}
                        </span>
                        <br />
                        <span className="dataname">
                          {this.props.t("step3ReceiptTxIndex")}:
                        </span>{" "}
                        <span className="result">
                          {this.state.receiptTxIndex}
                        </span>
                        <br />
                        <span className="dataname">
                          {this.props.t("step3ReceiptFrom")}:
                        </span>{" "}
                        <span className="result">{this.state.receiptFrom}</span>
                        <br />
                        <span className="dataname">
                          {this.props.t("step3ReceiptTo")}:
                        </span>
                        <span className="result">{this.state.receiptTo}</span>
                        <br />
                      </code>
                    </TabPanel>
                    <TabPanel>
                      <code className="block">
                        <span className="dataname">
                          {this.props.t("step3ReceiptBlockhash")}:
                        </span>{" "}
                        <span className="result">
                          {this.state.receiptBlockhash}
                        </span>
                        <br />
                        <span className="dataname">
                          {this.props.t("step3ReceiptBlocknumber")}:
                        </span>{" "}
                        <span className="result">
                          {this.state.receiptBlocknumber}
                        </span>
                        <br />
                        <span className="dataname">
                          {this.props.t("step3ReceiptTotalGas")}:
                        </span>{" "}
                        <span className="result">
                          {this.state.receiptTotalGas}
                        </span>
                        <br />
                        <span className="dataname">
                          {this.props.t("step3ReceiptGas")}:
                        </span>{" "}
                        <span className="result">{this.state.receiptGas}</span>
                        <br />
                        <span className="dataname">
                          {this.props.t("step3ReceiptConfirmations")}:
                        </span>{" "}
                        <span className="result">{this.state.receiptConf}</span>
                        <br />
                      </code>
                    </TabPanel>
                  </Tabs>
                </div>
              </div>
              <div className="row">
                <div className="col-md-4 col-sm-12 col-centered">
                  <div>
                    <button
                      type="button"
                      disabled={!this.state.receiptObj || this.state.working}
                      className="form-control btn btn-default formbtn"
                      aria-label={this.props.t("step3Download")}
                      onClick={this.downloadReceipt}
                    >
                      <span
                        className="glyphicon glyphicon-download"
                        aria-hidden="true"
                      >
                        &nbsp;
                      </span>
                      {this.props.t("step3Download")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

export default Step1ES;
