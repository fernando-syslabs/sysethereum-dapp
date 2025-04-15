import React, { Component } from "react";
import rconfig from "../SyscoinRelayI";
import { getProof } from "bitcoin-proof";
import Web3 from "web3";
import CONFIGURATION from "../config";
// This function detects most providers injected at window.ethereum
// import detectEthereumProvider from "@metamask/detect-provider";
const web3 = new Web3(Web3.givenProvider);
class Step3 extends Component {
  constructor(props) {
    super(props);
    this.state = {
      receiptStatus: "",
      receiptTxHash: "",
      working: false,
    };
    this.submitProofs = this.submitProofs.bind(this);
    this.setStateFromReceipt = this.setStateFromReceipt.bind(this);
    this.isValidated = this.isValidated.bind(this);
  }
  isValidated() {
    if (this.state.receiptObj === null) {
      return false;
    }
    this.props.updateStore({
      ...this.state,
      savedToCloud: false, // use this to notify step3 that some changes took place and prompt the user to save again
    });
    return true;
  }
  componentDidMount() {
    if (!this.props.getStore().nevm_blockhash || !this.props.getStore().txid) {
      this.props.jumpToStep(1);
    }
  }

  componentWillUnmount() {}

  async submitProofs() {
    const isBitcoinBased = window.pali.isBitcoinBased();
    if (isBitcoinBased && window.ethereum.wallet === "pali-v2") {
      await window.ethereum.request({
        method: "eth_changeUTXOEVM",
        params: [{ chainId: 57 }],
      });
      return;
    }
    if (!window.ethereum) {
      this.setState({
        buttonVal: false,
        buttonValMsg: this.props.t("step3InstallMetamask"),
      });
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
      this.setState({
        buttonVal: false,
        buttonValMsg: this.props.t("step3LoginMetamask"),
      });
     await window.ethereum.request({
        method: "eth_requestAccounts",
        params: [],
      });
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CONFIGURATION.ChainId }],
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask.
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
          this.setState({ buttonVal: false, buttonValMsg: addError.message });
          return;
        }
      } else {
        this.setState({ buttonVal: false, buttonValMsg: switchError.message });
        return;
      }
    }
    const provider = new Web3(window.ethereum);
    let ChainId = await provider.eth.getChainId();
    console.log({ ChainId });
    if (ChainId !== parseInt(CONFIGURATION.ChainId, 16)) {
      this.setState({ buttonVal: false, buttonValMsg: "Invalid network" });
      return;
    }
    let SyscoinRelay = new web3.eth.Contract(rconfig.data, rconfig.contract);
    SyscoinRelay.setProvider(provider);
    if (
      !SyscoinRelay ||
      !SyscoinRelay.methods ||
      !SyscoinRelay.methods.relayTx
    ) {
      this.setState({
        buttonVal: false,
        buttonValMsg: this.props.t("stepRelay"),
      });
      return;
    }
    this.setState({
      receiptStatus: "",
      receiptTxHash: "",
      buttonVal: true,
      buttonValMsg: "",
    });
    this.setState({
      buttonVal: true,
      buttonValMsg: this.props.t("step3AuthMetamask"),
    });
    const txsiblings = this.props.getStore().txsiblings;
    const txindex = this.props.getStore().txindex;
    const syscoinblockheader = this.props.getStore().syscoinblockheader;
    const nevmblockhash = this.props.getStore().nevm_blockhash;
    if (!txsiblings) {
      this.setState({ working: false });
      return;
    }
    let _txBytes = "0x" + this.props.getStore().txbytes;
    let _txSiblings = [];
    for (let i = 0; i < txsiblings.length; i++) {
      let _txSibling = "0x" + txsiblings[i];
      _txSiblings.push(_txSibling);
    }
    let merkleProof = getProof(txsiblings, txindex);
    for (let i = 0; i < merkleProof.sibling.length; i++) {
      merkleProof.sibling[i] = "0x" + merkleProof.sibling[i];
    }
    this.setState({ working: true });
    let thisObj = this;
    thisObj.state.receiptObj = null;
    let nevmBlock = await web3.eth.getBlock("0x" + nevmblockhash);
    if (!nevmBlock) {
      this.setState({ buttonVal: false, buttonValMsg: "NEVM block not found" });
      this.setState({ working: false });
      return;
    }
    let _syscoinBlockHeader = "0x" + syscoinblockheader;

    SyscoinRelay.methods
      .relayTx(
        nevmBlock.number,
        _txBytes,
        txindex,
        merkleProof.sibling,
        _syscoinBlockHeader
      )
      .send({ from: accounts[0], gas: 400000, transactionPollingTimeout: 1800})
      .once("transactionHash", function (hash) {
        thisObj.setState({
          receiptTxHash: hash,
          buttonVal: true,
          buttonValMsg: thisObj.props.t("step3PleaseWait"),
        });
      })
      .once("confirmation", function (confirmationNumber, receipt) {
        if (thisObj.state.receiptObj === null) {
          thisObj.setStateFromReceipt(receipt, null, confirmationNumber);
          thisObj.setState({ working: false });
        } else {
          thisObj.setState({ receiptConf: confirmationNumber });
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
            thisObj.setStateFromReceipt(receipt, message, 0);
          } else {
            thisObj.setState({ buttonVal: false, buttonValMsg: message });
          }
        }
      });
  }

  render() {
    // explicit class assigning based on validation
    let notValidClasses = {};
    if (typeof this.state.buttonVal == "undefined" || this.state.buttonVal) {
      notValidClasses.buttonCls = "has-success";
      notValidClasses.buttonValGrpCls = "val-success-tooltip";
    } else {
      notValidClasses.buttonCls = "has-error";
      notValidClasses.buttonValGrpCls = "val-err-tooltip mb30";
    }
    return (
      <div className="step step3">
        <div className="row">
          <form id="Form" className="form-horizontal">
            <div className="form-group">
              <label className="col-md-12">
                <h1
                  dangerouslySetInnerHTML={{
                    __html: this.props.t("step3Head"),
                  }}
                ></h1>
                <h3
                  dangerouslySetInnerHTML={{
                    __html: this.props.t("step3Description"),
                  }}
                ></h3>
              </label>
              <div className="row">
                <div className="col-md-4 col-sm-12 col-centered">
                  <div className={notValidClasses.buttonCls}>
                    <button
                      type="button"
                      disabled={this.state.working}
                      className="form-control btn btn-default formbtn"
                      aria-label={this.props.t("step3Button")}
                      onClick={this.submitProofs}
                    >
                      <span
                        className="glyphicon glyphicon-send"
                        aria-hidden="true"
                      >
                        &nbsp;
                      </span>
                      {this.props.t("step3Button")}
                    </button>
                    <div className={notValidClasses.buttonValGrpCls}>
                      {this.state.buttonValMsg}
                    </div>
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

export default Step3;
